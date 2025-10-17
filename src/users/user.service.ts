import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email/email.service';

type MemberRow = {
    userId: string;
    email: string;
    fullName: string;
    isActive: boolean;
    membershipId: string;
    status: string;
    createdAt: Date;
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
        if (!m) throw new NotFoundException('Membership not found for this tenant');
        return m;
    }

    // --------- Invite flow (email reset) ---------

    // --------- Invite flow (email vs reset) ---------
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

        // Create global user if missing (temp password)
        if (!user) {
            const tempPassword =
                Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);
            user = await this.prisma.user.create({
                data: {
                    email,
                    fullName,
                    passwordHash: await bcrypt.hash(tempPassword, 10),
                    isActive: true,
                },
            });
        }

        // Upsert membership (active)
        const membership = await this.prisma.userTenant.upsert({
            where: { userId_tenantId_unique: { userId: user.id, tenantId: data.tenantId } },
            create: { userId: user.id, tenantId: data.tenantId, status: 'active' },
            update: { status: 'active' },
        });

        // Validate role ids belong to this tenant
        if (data.roleIds?.length) {
            const roles = await this.prisma.role.findMany({
                where: { id: { in: data.roleIds }, tenantId: data.tenantId },
                select: { id: true },
            });
            if (roles.length !== data.roleIds.length) {
                throw new BadRequestException('One or more roles do not belong to this tenant');
            }
            await this.prisma.userTenantRole.createMany({
                data: data.roleIds.map((roleId) => ({ userTenantId: membership.id, roleId })),
                skipDuplicates: true,
            });
        }

        const appName = process.env.APP_NAME || 'our app';
        const base = process.env.FRONTEND_URL || 'http://localhost:3000';

        if (isNewUser) {
            // NEW user -> send reset link to set their first password
            const token = this.jwt.sign(
                { sub: user.id, email: user.email }, // global password reset
                { expiresIn: '15m' },
            );
            const resetLink = `${base}/reset-password?token=${encodeURIComponent(token)}`;

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
            // EXISTING user -> DO NOT send reset; send a simple invite/added email
            const signinLink = `${base}/login`;
            await this.email.sendMail(
                user.email,
                `You’ve been added to a new workspace`,
                `
        <h2>You're in!</h2>
        <p>Hi ${fullName},</p>
        <p>You’ve been added to a new workspace in <b>${appName}</b>. You can sign in with your existing password.</p>
        <p><a href="${signinLink}" target="_blank"
          style="background:#4B5563;color:white;padding:10px 15px;border-radius:6px;text-decoration:none;">
          Sign In
        </a></p>
      `,
            );

            return { message: 'User added to tenant. Sign-in email sent (no password reset).' };
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
                throw new BadRequestException('One or more roles do not belong to this tenant');
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
            throw new BadRequestException('One or more roles do not belong to this tenant');
        }

        await this.prisma.$transaction([
            this.prisma.userTenantRole.deleteMany({ where: { userTenantId: membership.id } }),
            this.prisma.userTenantRole.createMany({
                data: roleIds.map((roleId) => ({ userTenantId: membership.id, roleId })),
            }),
        ]);

        return { ok: true };
    }

    async addRolesForUserInTenant(userId: string, tenantId: string, roleIds: string[]) {
        const membership = await this.getMembershipOrThrow(userId, tenantId);

        const roles = await this.prisma.role.findMany({ where: { id: { in: roleIds }, tenantId } });
        if (roles.length !== roleIds.length) {
            throw new BadRequestException('One or more roles do not belong to this tenant');
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
            roles: m.roles.map((r) => r.role.name),
        }));

        return { data, total, page, pageSize };
    }
}