import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../email/email.service';

type JwtPayload = {
    sub: string;            // user id
    email: string;
    tenantId?: string;      // present for tenant-scoped tokens
    roles?: string[];
    perms?: string[];
    typ: 'owner' | 'member' | 'owner-global';
};

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly email: EmailService,
    ) { }

    private flattenPerms(rolePerms: Array<{ permission: { name: string } }>) {
        return rolePerms.map((rp) => rp.permission.name);
    }

    private toSafeUser(u: { id: string; email: string; fullName: string }) {
        return { id: u.id, email: u.email, fullName: u.fullName };
    }

    async check(payload: JwtPayload) {
        // Must be an authenticated request (JwtAuthGuard guarantees a decoded payload)
        if (!payload?.sub || !payload?.email) {
            throw new UnauthorizedException('Invalid token');
        }

        // Require tenant scoping for this endpoint (per your ask: "for that tenant only")
        if (!payload.tenantId) {
            // If you prefer to allow global, change this to return a global profile.
            throw new BadRequestException('Token is not tenant-scoped');
        }

        // Get user basic info
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, email: true, fullName: true, isActive: true },
        });
        if (!user || !user.isActive) {
            throw new UnauthorizedException('User not active');
        }

        // Confirm membership for the tenant in the token, and gather roles/perms fresh
        const membership = await this.prisma.userTenant.findUnique({
            where: { userId_tenantId_unique: { userId: user.id, tenantId: payload.tenantId } },
            include: {
                //status: true, // if your schema exposes it directly; otherwise remove
                roles: {
                    include: {
                        role: {
                            include: { rolePerms: { include: { permission: true } } },
                        },
                    },
                },
                tenant: { select: { id: true, name: true, slug: true } },
            },
        });

        if (!membership) {
            throw new UnauthorizedException('No membership for this tenant');
        }

        // Ensure active membership
        // If your model has membership.status: 'active' | 'invited' | ... (as seen in memberLogin)
        // adjust the check accordingly:
        // @ts-ignore – only if TypeScript complains about "status"
        if (membership.status !== 'active') {
            throw new UnauthorizedException('Membership is not active for this tenant');
        }

        const roles = membership.roles.map((r) => r.role.name);
        const perms = membership.roles.flatMap((r) =>
            r.role.rolePerms.map((rp) => rp.permission.name),
        );

        // Build a consistent response
        return {
            valid: true,
            typ: payload.typ,                // 'owner' | 'member'
            user: this.toSafeUser(user),     // { id, email, fullName }
            tenant: membership.tenant,       // { id, name, slug }
            roles,
            perms,
        };
    }

    // -------- OWNER REGISTER (GLOBAL USER ONLY) ----------
    async ownerRegister(email: string, password: string, fullName?: string) {
        const normEmail = email.trim().toLowerCase();
        const existing = await this.prisma.user.findUnique({ where: { email: normEmail } });
        if (existing) throw new BadRequestException('Email already registered');

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await this.prisma.user.create({
            data: {
                email: normEmail,
                passwordHash,
                fullName: fullName?.trim() || normEmail.split('@')[0],
                isActive: true,
            },
            select: { id: true, email: true, fullName: true },
        });

        // (Optional) auto-login token for convenience — comment out if you don’t want it
        const access_token = this.jwt.sign({ sub: user.id, email: user.email, typ: 'owner-global' }, { expiresIn: '1h' });

        return { message: 'Owner registered successfully', user, access_token };
    }

    // -------- OWNER LOGIN ----------
    async ownerLogin(email: string, password: string, tenantId?: string) {
        const user = await this.prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: { id: true, email: true, fullName: true, isActive: true, passwordHash: true },
        });
        if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) throw new UnauthorizedException('Invalid credentials');

        // If a tenantId was provided, proceed with tenant-scoped login
        if (tenantId) {
            const membership = await this.prisma.userTenant.findUnique({
                where: { userId_tenantId_unique: { userId: user.id, tenantId } },
                include: {
                    roles: {
                        include: {
                            role: { include: { rolePerms: { include: { permission: true } } } },
                        },
                    },
                    tenant: { select: { id: true, name: true, slug: true } },
                },
            });
            if (!membership || !membership.isOwner) {
                throw new UnauthorizedException('Not an owner of this tenant');
            }

            const roles = membership.roles.map((r) => r.role.name);
            const perms = membership.roles.flatMap((r) =>
                r.role.rolePerms.map((rp) => rp.permission.name),
            );

            const token = this.jwt.sign(
                {
                    sub: user.id,
                    email: user.email,
                    tenantId: membership.tenant.id,
                    roles,
                    perms,
                    typ: 'owner', // tenant-scoped owner
                },
                { expiresIn: '1h' },
            );

            return {
                access_token: token,
                user: this.toSafeUser(user),
                tenant: membership.tenant,
            };
        }

        // No tenantId provided → list owned tenants
        const owned = await this.prisma.userTenant.findMany({
            where: { userId: user.id, isOwner: true, status: 'active' },
            include: { tenant: { select: { id: true, name: true, slug: true } } },
            orderBy: { tenant: { name: 'asc' } },
        });

        // 🔸 If owner has zero tenants, return a global token so they can create one
        if (owned.length === 0) {
            // Keep this token "global owner" (no tenantId yet). You can gate tenant creation
            // in your tenant module by checking typ === 'owner-global' (or add a specific perm).
            const access_token = this.jwt.sign(
                { sub: user.id, email: user.email, typ: 'owner-global' },
                { expiresIn: '1h' },
            );

            return {
                needTenantSelection: false,
                user: this.toSafeUser(user),
                access_token,
                ownedTenants: [],
            };
        }

        // Otherwise behave as before (ask UI to let them pick a tenant)
        return {
            needTenantSelection: true,
            user: this.toSafeUser(user),
            ownedTenants: owned.map((m) => m.tenant),
        };
    }

    // -------- MEMBER LOGIN ----------
    async memberLogin(
        email: string,
        password: string,
        tenantId?: string,
    ): Promise<
        | { access_token: string; user: { id: string; email: string; fullName: string }; tenant: { id: string; name: string; slug: string } }
        | { needTenantSelection: true; user: { id: string; email: string; fullName: string }; tenants: { id: string; name: string; slug: string }[] }
    > {
        const user = await this.prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: { id: true, email: true, fullName: true, isActive: true, passwordHash: true },
        });
        if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');
        if (!(await bcrypt.compare(password, user.passwordHash))) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (tenantId) {
            const membership = await this.prisma.userTenant.findUnique({
                where: { userId_tenantId_unique: { userId: user.id, tenantId } },
                include: {
                    roles: { include: { role: { include: { rolePerms: { include: { permission: true } } } } } },
                    tenant: { select: { id: true, name: true, slug: true } },
                },
            });

            if (!membership) {
                throw new UnauthorizedException('You are not a member of this tenant.');
            }
            if (membership.status !== 'active') {
                throw new UnauthorizedException('Your membership in this tenant is not active.');
            }

            const roles = membership.roles.map((r) => r.role.name);
            const perms = membership.roles.flatMap((r) => this.flattenPerms(r.role.rolePerms));

            const token = this.jwt.sign(
                { sub: user.id, email: user.email, tenantId, roles, perms, typ: 'member' },
                { expiresIn: '1h' },
            );

            return {
                access_token: token,
                user: this.toSafeUser(user),
                tenant: membership.tenant,
            };
        }

        const memberships = await this.prisma.userTenant.findMany({
            where: { userId: user.id, status: 'active' },
            include: { tenant: { select: { id: true, name: true, slug: true } } },
            orderBy: { tenant: { name: 'asc' } },
        });

        if (memberships.length === 0) {
            throw new UnauthorizedException('No active memberships found');
        }

        if (memberships.length === 1) {
            return this.memberLogin(email, password, memberships[0].tenant.id);
        }

        return {
            needTenantSelection: true,
            user: this.toSafeUser(user),
            tenants: memberships.map((m) => m.tenant),
        };
    }

    /**
    * Send short-lived reset token to the user's email.
    * Token payload includes { sub, email }.
    * Optionally attaches a tenantId in the link as a redirect hint for frontend ONLY.
    */
    async requestPasswordReset(email: string, tenantHint?: string) {
        const user = await this.prisma.user.findUnique({
            where: { email: email.trim().toLowerCase() },
            select: { id: true, email: true, isActive: true, fullName: true },
        });
        // To avoid account enumeration, you can always return success.
        if (!user || !user.isActive) {
            return { message: 'If an account exists for that email, a reset link has been sent.' };
        }

        const token = this.jwt.sign(
            { sub: user.id, email: user.email }, // no tenant needed to reset a global password
            { expiresIn: '15m' }
        );

        const base = 'http://203.215.170.100';
        const resetLink =
            tenantHint
                ? `${base}/reset-password?token=${encodeURIComponent(token)}&tenantId=${encodeURIComponent(tenantHint)}`
                : `${base}/reset-password?token=${encodeURIComponent(token)}`;

        //send the email
        await this.email.sendMail(
            user.email,
            'Reset your password',
            `<p>Hello ${user.fullName || ''}</p>
       <p>Click below to reset your password:</p>
       <a href="${resetLink}" target="_blank">Reset Password</a>
       <p>This link expires in 15 minutes.</p>`
        );

        return { message: 'If an account exists for that email, a reset link has been sent.' };
    }

    /**
     * Accepts reset token + new password. Updates the user's global password.
     * Works for both owners & members. Ignores any tenant in the token if present.
     */
    async resetPassword(token: string, newPassword: string) {
        let payload: any;
        try {
            payload = this.jwt.verify(token);
        } catch {
            throw new BadRequestException('Invalid or expired token');
        }

        const user = await this.prisma.user.findFirst({
            where: { id: payload.sub, email: payload.email },
            select: { id: true },
        });
        if (!user) throw new BadRequestException('Invalid or expired token');

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash },
        });

        // (Optional) Invalidate existing sessions by rotating a user-level token version, etc.

        return { message: 'Password reset successfully' };
    }

    /**
     * Logged-in user self-service password change (no email link).
     * Requires valid JWT (any tenant). Does not change memberships.
     */
    async changeOwnPassword(currentPassword: string, newPassword: string) {
        // In Nest, req.user is set in JwtStrategy.validate; but we’re in the service.
        // Retrieve current user by sub from a request-scoped context if you use one,
        // or pass userId from controller after extracting from req.user.
        throw new ForbiddenException('Wire userId from controller if you enable this endpoint.');
    }



}