import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email/email.service';
import { UpdateUserDto } from './dto/update-user.dto';

type MemberRow = {
    userId: string;
    email: string;
    fullName: string;
    isActive: boolean;
    membershipId: string;
    status: string;
    createdAt: Date;
    invitedAt?: Date | null;
    roles: string[];
};

@Injectable()
export class UserService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly email: EmailService,
    ) { }

    private normalizeEmail(email?: string) {
        return (email ?? '').trim().toLowerCase();
    }

    private safeName(fullName: string | undefined, email: string) {
        // fallback to the part before '@' if no name given
        const fallback = email.split('@')[0] || 'User';
        return (fullName ?? fallback).trim();
    }

    // --------- Core lookups ---------

    async findUserByEmail(email: string) {
        return this.prisma.user.findUnique({ where: { email: this.normalizeEmail(email) } });
    }

    private async getMembershipOrThrow(userId: string, tenantId: string) {
        const m = await this.prisma.userTenant.findUnique({
            where: { userId_tenantId_unique: { userId, tenantId } },
        });
        if (!m) throw new NotFoundException('Membership not found for this company');
        return m;
    }

    // --------- Invite flow (email vs reset) ---------

    // user.service.ts

    async inviteUser(data: {
        email: string;
        fullName?: string;
        tenantId: string;
        roleIds?: string[];
    }): Promise<{ message: string }> {
        const email = this.normalizeEmail(data.email);
        if (!email) throw new BadRequestException('Email is required');

        let user = await this.findUserByEmail(email);
        const fullName = this.safeName(data.fullName, email);
        const isNewUser = !user;

        if (!user) {
            const tempPassword =
                Math.random().toString(36).slice(-8) +
                Math.random().toString(36).slice(-4);
            user = await this.prisma.user.create({
                data: {
                    email,
                    fullName,
                    passwordHash: await bcrypt.hash(tempPassword, 10),
                    isActive: true,
                },
            });
        }

        // Ensure no duplicate membership
        const existingMembership = await this.prisma.userTenant.findUnique({
            where: { userId_tenantId_unique: { userId: user.id, tenantId: data.tenantId } },
            select: { id: true, status: true },
        });
        if (existingMembership) {
            throw new BadRequestException('User is already a member of this company');
        }

        // Create membership in INVITED state (with invitedAt)
        let membershipId: string;
        try {
            const m = await this.prisma.userTenant.create({
                data: {
                    userId: user.id,
                    tenantId: data.tenantId,
                    status: 'invited',
                    invitedAt: new Date(),
                },
                select: { id: true },
            });
            membershipId = m.id;

            // Attach roles (validate tenant)
            if (data.roleIds?.length) {
                const roles = await this.prisma.role.findMany({
                    where: { id: { in: data.roleIds }, tenantId: data.tenantId },
                    select: { id: true },
                });
                if (roles.length !== data.roleIds.length) {
                    throw new BadRequestException('One or more roles do not belong to this company');
                }
                await this.prisma.userTenantRole.createMany({
                    data: data.roleIds.map((roleId) => ({ userTenantId: membershipId!, roleId })),
                    skipDuplicates: true,
                });
            }
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new BadRequestException('User is already a member of this company');
            }
            throw e;
        }

        // === 7-day invite token ===
        const inviteToken = this.jwt.sign(
            {
                kind: 'invite',
                userId: user.id,
                tenantId: data.tenantId,
                membershipId,
                isNewUser, // let frontend/backend know what to do after accept
            },
            { expiresIn: '7d' } // <-- 7 days
        );

        // Email: everyone gets the same "Accept invitation" link
        const appName = process.env.APP_NAME || 'DockiShip';
        const base = 'http://203.215.170.100'; // keep your base

        const acceptLink = `${base}/invite/accept?token=${encodeURIComponent(inviteToken)}`;

        await this.email.sendMail(
            user.email,
            `You're invited to ${appName}`,
            `
      <h2>Invitation</h2>
      <p>Hi ${fullName},</p>
      <p>You’ve been invited to <b>${appName}</b>. To accept the invitation, please click the link below. If you think this was a mistake, please ignore this email.</p>
      <p><a href="${acceptLink}" target="_blank"
        style="background:#4F46E5;color:white;padding:10px 15px;border-radius:6px;text-decoration:none;">
        Accept Invitation
      </a></p>
      <p>This invite link expires in 7 days.</p>
    `
        );

        return { message: 'Invitation sent (expires in 7 days).' };
    }

    // user.service.ts

    async acceptInvitation(inviteToken: string) {
        let payload: any;
        try {
            payload = this.jwt.verify(inviteToken);
        } catch {
            throw new BadRequestException('Invalid or expired invitation token');
        }

        if (payload?.kind !== 'invite') {
            throw new BadRequestException('Invalid invitation token');
        }

        const { userId, tenantId, membershipId, isNewUser } = payload as {
            userId: string; tenantId: string; membershipId: string; isNewUser: boolean;
        };

        // Membership must exist and still be INVITED
        const m = await this.prisma.userTenant.findUnique({
            where: { userId_tenantId_unique: { userId, tenantId } },
            select: { id: true, status: true },
        });
        if (!m || m.id !== membershipId) {
            throw new NotFoundException('Invitation no longer valid for this membership');
        }
        if (m.status !== 'invited') {
            // Already accepted, suspended, etc.
            if (m.status === 'active') return { ok: true, alreadyActive: true, needsPasswordReset: false };
            throw new BadRequestException(`Cannot accept an invitation in status "${m.status}"`);
        }

        await this.prisma.userTenant.update({
            where: { userId_tenantId_unique: { userId, tenantId } },
            data: { status: 'active', acceptedAt: new Date() },
        });

        // If the user was created by the invite flow, ask frontend to show reset-password
        if (isNewUser) {
            const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
            const resetToken = this.jwt.sign(
                { sub: userId, email: user?.email, reason: 'initial_reset' },
                { expiresIn: '15m' }
            );
            return {
                ok: true,
                needsPasswordReset: true,
                resetToken, // frontend can route to /reset-password?token=...
            };
        }

        return { ok: true, needsPasswordReset: false };
    }


    async inviteUserOld(data: {
        email: string;
        fullName?: string;
        tenantId: string;
        roleIds?: string[];
    }): Promise<{ message: string }> {
        const email = this.normalizeEmail(data.email);
        if (!email) throw new BadRequestException('Email is required');

        // 1) Ensure user exists (create global account if needed)
        let user = await this.findUserByEmail(email);
        const fullName = this.safeName(data.fullName, email);
        const isNewUser = !user;

        if (!user) {
            const tempPassword =
                Math.random().toString(36).slice(-8) +
                Math.random().toString(36).slice(-4);
            user = await this.prisma.user.create({
                data: {
                    email,
                    fullName,
                    passwordHash: await bcrypt.hash(tempPassword, 10),
                    isActive: true,
                },
            });
        }

        // 2) Check membership — if already present, return an error
        const existingMembership = await this.prisma.userTenant.findUnique({
            where: {
                userId_tenantId_unique: {
                    userId: user.id,
                    tenantId: data.tenantId,
                },
            },
            select: { id: true, status: true },
        });

        if (existingMembership) {
            // You can customize the message by status if you like:
            // e.g. if (existingMembership.status !== 'active') { ... }
            throw new BadRequestException('User is already a member of this company');
        }

        // 3) Create membership (active) + roles (validated to the same tenant)
        try {
            const membership = await this.prisma.userTenant.create({
                data: {
                    userId: user.id,
                    tenantId: data.tenantId,
                    status: 'active',
                },
                select: { id: true },
            });

            if (data.roleIds?.length) {
                // Ensure all roleIds belong to this tenant
                const roles = await this.prisma.role.findMany({
                    where: { id: { in: data.roleIds }, tenantId: data.tenantId },
                    select: { id: true },
                });
                if (roles.length !== data.roleIds.length) {
                    throw new BadRequestException(
                        'One or more roles do not belong to this company',
                    );
                }
                await this.prisma.userTenantRole.createMany({
                    data: data.roleIds.map((roleId) => ({
                        userTenantId: membership.id,
                        roleId,
                    })),
                    skipDuplicates: true,
                });
            }
        } catch (e) {
            // In case of a race condition: two invites at once
            if (
                e instanceof Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2002'
            ) {
                // unique constraint on (userId, tenantId)
                throw new BadRequestException('User is already a member of this company');
            }
            throw e;
        }

        // 4) Email
        const appName = process.env.APP_NAME || 'DockiShip';
        const base = 'http://203.215.170.100';

        if (isNewUser) {
            // New user → send password setup link
            const token = this.jwt.sign(
                { sub: user.id, email: user.email },
                { expiresIn: '15m' },
            );
            const resetLink = `${base}/reset-password?token=${encodeURIComponent(
                token,
            )}`;

            await this.email.sendMail(
                user.email,
                `You're invited to ${appName} – set your password`,
                `
          <h2>Welcome</h2>
          <p>Hi ${fullName},</p>
          <p>You’ve been invited to <b>${appName}</b>. Please set your password to sign in.</p>
          <p><a href="${resetLink}" target="_blank"
            style="background:#4F46E5;color:white;padding:10px 15px;border-radius:6px;text-decoration:none;">
            Set Your Password
          </a></p>
          <p>This link expires in 15 minutes.</p>
        `,
            );

            return { message: 'Invitation sent with password setup link' };
        } else {
            // Existing user → a simple “added to workspace” mail
            const signinLink = `${base}/login`;
            await this.email.sendMail(
                user.email,
                `You’ve been added to a new workspace`,
                `
          <h2>You're in!</h2>
          <p>Hi ${fullName},</p>
          <p>You’ve been added to a new workspace in <b>${appName}</b>. Sign in with your existing password.</p>
          <p><a href="${signinLink}" target="_blank"
            style="background:#4B5563;color:white;padding:10px 15px;border-radius:6px;text-decoration:none;">
            Sign In
          </a></p>
        `,
            );

            return { message: 'User added to company and notified.' };
        }
    }

    // --------- Direct member creation with known password ---------

    async createMemberWithPassword(data: {
        tenantId: string;
        email: string;
        fullName?: string;          // <-- make optional
        password: string;
        roleIds?: string[];
    }) {
        const email = this.normalizeEmail(data.email);
        if (!email) throw new BadRequestException('Email is required');

        let user = await this.findUserByEmail(email);
        const fullName = this.safeName(data.fullName, email);

        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    email,
                    fullName, // <-- safe
                    passwordHash: await bcrypt.hash(data.password, 10),
                    isActive: true,
                },
            });
        }

        const membership = await this.prisma.userTenant.upsert({
            where: { userId_tenantId_unique: { userId: user.id, tenantId: data.tenantId } },
            create: { userId: user.id, tenantId: data.tenantId, status: 'active' },
            update: { status: 'active' },
        });

        if (data.roleIds?.length) {
            const roles = await this.prisma.role.findMany({
                where: { id: { in: data.roleIds }, tenantId: data.tenantId },
                select: { id: true },
            });
            if (roles.length !== data.roleIds.length) {
                throw new BadRequestException('One or more roles do not belong to this company');
            }
            await this.prisma.userTenantRole.createMany({
                data: data.roleIds.map((roleId) => ({ userTenantId: membership.id, roleId })),
                skipDuplicates: true,
            });
        }

        return {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            tenantId: data.tenantId,
            status: 'active',
        };
    }

    // --------- Membership role wiring ---------

    async setRolesForUserInTenant(userId: string, tenantId: string, roleIds: string[]) {
        const membership = await this.getMembershipOrThrow(userId, tenantId);

        const roles = await this.prisma.role.findMany({ where: { id: { in: roleIds }, tenantId } });
        if (roles.length !== roleIds.length) {
            throw new BadRequestException('One or more roles do not belong to this company');
        }

        await this.prisma.$transaction([
            this.prisma.userTenantRole.deleteMany({ where: { userTenantId: membership.id } }),
            this.prisma.userTenantRole.createMany({
                data: roleIds.map((roleId) => ({ userTenantId: membership.id, roleId })),
            }),
        ]);

        return { ok: true };
    }

    /**
 * Delete the user's membership in a tenant (and its role links).
 * Does NOT delete the global user account.
 * Guards you from removing an owner membership (optional safety).
 */
    async removeUserFromTenant(userId: string, tenantId: string) {
        // Ensure membership exists
        const m = await this.prisma.userTenant.findUnique({
            where: { userId_tenantId_unique: { userId, tenantId } },
            include: { tenant: true },
        });
        if (!m) {
            throw new NotFoundException('Membership not found for this company');
        }

        // Optional: prevent deleting an owner’s own last owner membership, etc.
        // If you track ownership on membership, check it here (pseudo):
        // if (m.isOwner) throw new BadRequestException('Cannot remove owner membership');

        await this.prisma.$transaction(async (tx) => {
            // remove role links for this membership
            await tx.userTenantRole.deleteMany({ where: { userTenantId: m.id } });
            // delete membership row
            await tx.userTenant.delete({
                where: { userId_tenantId_unique: { userId, tenantId } },
            });
        });

        return { ok: true };
    }

    async addRolesForUserInTenant(userId: string, tenantId: string, roleIds: string[]) {
        const membership = await this.getMembershipOrThrow(userId, tenantId);

        const roles = await this.prisma.role.findMany({ where: { id: { in: roleIds }, tenantId } });
        if (roles.length !== roleIds.length) {
            throw new BadRequestException('One or more roles do not belong to this company');
        }

        await this.prisma.userTenantRole.createMany({
            data: roleIds.map((roleId) => ({ userTenantId: membership.id, roleId })),
            skipDuplicates: true,
        });

        return { ok: true };
    }

    async removeRolesForUserInTenant(userId: string, tenantId: string, roleIds: string[]) {
        const membership = await this.getMembershipOrThrow(userId, tenantId);
        await this.prisma.userTenantRole.deleteMany({
            where: { userTenantId: membership.id, roleId: { in: roleIds } },
        });
        return { ok: true };
    }

    // --------- Membership (per-tenant) activation ---------

    async suspendMembership(userId: string, tenantId: string) {
        await this.getMembershipOrThrow(userId, tenantId);
        await this.prisma.userTenant.update({
            where: { userId_tenantId_unique: { userId, tenantId } },
            data: { status: 'suspended' },
        });
        return { ok: true };
    }

    async activateMembership(userId: string, tenantId: string) {
        await this.getMembershipOrThrow(userId, tenantId);
        await this.prisma.userTenant.update({
            where: { userId_tenantId_unique: { userId, tenantId } },
            data: { status: 'active' },
        });
        return { ok: true };
    }

    // --------- List members by tenant ---------

    async listMembersByTenant(
        tenantId: string,
        opts?: { page?: number; pageSize?: number; search?: string },
    ) {
        const page = Math.max(1, Number(opts?.page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(opts?.pageSize) || 20));
        const q = (opts?.search ?? '').trim();

        const whereMembership: Prisma.UserTenantWhereInput = {
            tenantId,
            ...(q
                ? {
                    user: {
                        OR: [
                            { email: { contains: q } },
                            { fullName: { contains: q } },
                        ],
                    },
                }
                : {}),
        };

        const [rows, total] = await this.prisma.$transaction([
            this.prisma.userTenant.findMany({
                where: whereMembership,
                include: {
                    user: true,
                    roles: { include: { role: true } },
                },
                orderBy: { user: { createdAt: 'desc' } },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.userTenant.count({ where: whereMembership }),
        ]);

        const data: MemberRow[] = rows.map((m) => ({
            userId: m.userId,
            email: m.user.email,
            fullName: m.user.fullName,
            isActive: m.user.isActive,
            createdAt: m.user.createdAt,
            membershipId: m.id,
            status: m.status,
            invitedAt: m.invitedAt ?? null,
            roles: m.roles.map((r) => r.role.name),
        }));

        return { data, total, page, pageSize };
    }

    async updateUserInTenant(userId: string, dto: UpdateUserDto) {
        // Ensure the user actually belongs to this tenant
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            //include: { user: true },
        });

        // Build partial update; avoid sending undefined fields
        const data: any = {};
        if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
        if (dto.phone !== undefined) data.phone = dto.phone.trim();
        if (dto.country !== undefined) data.country = dto.country.trim().toUpperCase();
        if (dto.isActive !== undefined) data.isActive = dto.isActive;

        if (Object.keys(data).length === 0) {
            // nothing to update — return current record
            return {
                id: user?.id,
                email: user?.email,
                fullName: user?.fullName,
                phone: user?.phone ?? null,
                country: user?.country ?? null,
                //isActive: user.isActive,
            };
        }

        const updated = await this.prisma.user.update({
            where: { id: userId },
            data,
            select: {
                id: true,
                email: true,
                fullName: true,
                phone: true,
                country: true,
                //isActive: true,
            },
        });

        return updated;
    }
}
