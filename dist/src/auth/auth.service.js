"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../database/prisma.service");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const email_service_1 = require("../email/email.service");
let AuthService = class AuthService {
    constructor(prisma, jwt, email) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.email = email;
    }
    flattenPerms(rolePerms) {
        return rolePerms.map((rp) => rp.permission.name);
    }
    toSafeUser(u) {
        return { id: u.id, email: u.email, fullName: u.fullName };
    }
    // -------- OWNER REGISTER (GLOBAL USER ONLY) ----------
    async ownerRegister(email, password, fullName) {
        const normEmail = email.trim().toLowerCase();
        const existing = await this.prisma.user.findUnique({ where: { email: normEmail } });
        if (existing)
            throw new common_1.BadRequestException('Email already registered');
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
    async ownerLogin(email, password, tenantId) {
        const user = await this.prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: { id: true, email: true, fullName: true, isActive: true, passwordHash: true },
        });
        if (!user || !user.isActive)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok)
            throw new common_1.UnauthorizedException('Invalid credentials');
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
                throw new common_1.UnauthorizedException('Not an owner of this tenant');
            }
            const roles = membership.roles.map((r) => r.role.name);
            const perms = membership.roles.flatMap((r) => this.flattenPerms(r.role.rolePerms));
            const token = this.jwt.sign({ sub: user.id, email: user.email, tenantId: membership.tenant.id, roles, perms, typ: 'owner' }, { expiresIn: '1h' });
            return {
                access_token: token,
                user: this.toSafeUser(user),
                tenant: membership.tenant,
            };
        }
        const owned = await this.prisma.userTenant.findMany({
            where: { userId: user.id, isOwner: true, status: 'active' },
            include: { tenant: { select: { id: true, name: true, slug: true } } },
            orderBy: { tenant: { name: 'asc' } },
        });
        return {
            needTenantSelection: true,
            user: this.toSafeUser(user),
            ownedTenants: owned.map((m) => m.tenant),
        };
    }
    // -------- MEMBER LOGIN ----------
    async memberLogin(email, password, tenantId) {
        const user = await this.prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: { id: true, email: true, fullName: true, isActive: true, passwordHash: true },
        });
        if (!user || !user.isActive)
            throw new common_1.UnauthorizedException('Invalid credentials');
        if (!(await bcrypt.compare(password, user.passwordHash))) {
            throw new common_1.UnauthorizedException('Invalid credentials');
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
                throw new common_1.UnauthorizedException('You are not a member of this tenant.');
            }
            if (membership.status !== 'active') {
                throw new common_1.UnauthorizedException('Your membership in this tenant is not active.');
            }
            const roles = membership.roles.map((r) => r.role.name);
            const perms = membership.roles.flatMap((r) => this.flattenPerms(r.role.rolePerms));
            const token = this.jwt.sign({ sub: user.id, email: user.email, tenantId, roles, perms, typ: 'member' }, { expiresIn: '1h' });
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
            throw new common_1.UnauthorizedException('No active memberships found');
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
    async requestPasswordReset(email, tenantHint) {
        const user = await this.prisma.user.findUnique({
            where: { email: email.trim().toLowerCase() },
            select: { id: true, email: true, isActive: true, fullName: true },
        });
        // To avoid account enumeration, you can always return success.
        if (!user || !user.isActive) {
            return { message: 'If an account exists for that email, a reset link has been sent.' };
        }
        const token = this.jwt.sign({ sub: user.id, email: user.email }, // no tenant needed to reset a global password
        { expiresIn: '15m' });
        const base = process.env.FRONTEND_URL || 'http://localhost:3000';
        const resetLink = tenantHint
            ? `${base}/reset-password?token=${encodeURIComponent(token)}&tenantId=${encodeURIComponent(tenantHint)}`
            : `${base}/reset-password?token=${encodeURIComponent(token)}`;
        //send the email (implement your EmailService)
        //Keep it generic; works for both owner/member.
        //Example:
        await this.email.sendMail(user.email, 'Reset your password', `<p>Hello ${user.fullName || ''}</p>
       <p>Click below to reset your password:</p>
       <a href="${resetLink}" target="_blank">Reset Password</a>
       <p>This link expires in 15 minutes.</p>`);
        return { message: 'If an account exists for that email, a reset link has been sent.' };
    }
    /**
     * Accepts reset token + new password. Updates the user's global password.
     * Works for both owners & members. Ignores any tenant in the token if present.
     */
    async resetPassword(token, newPassword) {
        let payload;
        try {
            payload = this.jwt.verify(token);
        }
        catch {
            throw new common_1.BadRequestException('Invalid or expired token');
        }
        const user = await this.prisma.user.findFirst({
            where: { id: payload.sub, email: payload.email },
            select: { id: true },
        });
        if (!user)
            throw new common_1.BadRequestException('Invalid or expired token');
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
    async changeOwnPassword(currentPassword, newPassword) {
        // In Nest, req.user is set in JwtStrategy.validate; but we’re in the service.
        // Retrieve current user by sub from a request-scoped context if you use one,
        // or pass userId from controller after extracting from req.user.
        throw new common_1.ForbiddenException('Wire userId from controller if you enable this endpoint.');
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        email_service_1.EmailService])
], AuthService);
//# sourceMappingURL=auth.service.js.map