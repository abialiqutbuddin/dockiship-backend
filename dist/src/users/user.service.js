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
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../database/prisma.service");
const bcrypt = __importStar(require("bcrypt"));
const jwt_1 = require("@nestjs/jwt");
const email_service_1 = require("../email/email.service");
let UserService = class UserService {
    constructor(prisma, jwt, email) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.email = email;
    }
    normalizeEmail(email) {
        return (email ?? '').trim().toLowerCase();
    }
    safeName(fullName, email) {
        // fallback to the part before '@' if no name given
        const fallback = email.split('@')[0] || 'User';
        return (fullName ?? fallback).trim();
    }
    // --------- Core lookups ---------
    async findUserByEmail(email) {
        return this.prisma.user.findUnique({ where: { email: this.normalizeEmail(email) } });
    }
    async getMembershipOrThrow(userId, tenantId) {
        const m = await this.prisma.userTenant.findUnique({
            where: { userId_tenantId_unique: { userId, tenantId } },
        });
        if (!m)
            throw new common_1.NotFoundException('Membership not found for this tenant');
        return m;
    }
    // --------- Invite flow (email reset) ---------
    // --------- Invite flow (email vs reset) ---------
    async inviteUser(data) {
        const email = this.normalizeEmail(data.email);
        if (!email)
            throw new common_1.BadRequestException('Email is required');
        let user = await this.findUserByEmail(email);
        const fullName = this.safeName(data.fullName, email);
        const isNewUser = !user;
        // Create global user if missing (temp password)
        if (!user) {
            const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);
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
                throw new common_1.BadRequestException('One or more roles do not belong to this tenant');
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
            const token = this.jwt.sign({ sub: user.id, email: user.email }, // global password reset
            { expiresIn: '15m' });
            const resetLink = `${base}/reset-password?token=${encodeURIComponent(token)}`;
            await this.email.sendMail(user.email, `You're invited to ${appName} – set your password`, `
        <h2>Welcome</h2>
        <p>Hi ${fullName},</p>
        <p>You’ve been invited to <b>${appName}</b>. Please set your password to sign in.</p>
        <p><a href="${resetLink}" target="_blank"
          style="background:#4F46E5;color:white;padding:10px 15px;border-radius:6px;text-decoration:none;">
          Set Your Password
        </a></p>
        <p>This link expires in 15 minutes.</p>
      `);
            return { message: 'Invitation sent with password setup link' };
        }
        else {
            // EXISTING user -> DO NOT send reset; send a simple invite/added email
            const signinLink = `${base}/login`;
            await this.email.sendMail(user.email, `You’ve been added to a new workspace`, `
        <h2>You're in!</h2>
        <p>Hi ${fullName},</p>
        <p>You’ve been added to a new workspace in <b>${appName}</b>. You can sign in with your existing password.</p>
        <p><a href="${signinLink}" target="_blank"
          style="background:#4B5563;color:white;padding:10px 15px;border-radius:6px;text-decoration:none;">
          Sign In
        </a></p>
      `);
            return { message: 'User added to tenant. Sign-in email sent (no password reset).' };
        }
    }
    // --------- Direct member creation with known password ---------
    async createMemberWithPassword(data) {
        const email = this.normalizeEmail(data.email);
        if (!email)
            throw new common_1.BadRequestException('Email is required');
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
                throw new common_1.BadRequestException('One or more roles do not belong to this tenant');
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
    async setRolesForUserInTenant(userId, tenantId, roleIds) {
        const membership = await this.getMembershipOrThrow(userId, tenantId);
        const roles = await this.prisma.role.findMany({ where: { id: { in: roleIds }, tenantId } });
        if (roles.length !== roleIds.length) {
            throw new common_1.BadRequestException('One or more roles do not belong to this tenant');
        }
        await this.prisma.$transaction([
            this.prisma.userTenantRole.deleteMany({ where: { userTenantId: membership.id } }),
            this.prisma.userTenantRole.createMany({
                data: roleIds.map((roleId) => ({ userTenantId: membership.id, roleId })),
            }),
        ]);
        return { ok: true };
    }
    async addRolesForUserInTenant(userId, tenantId, roleIds) {
        const membership = await this.getMembershipOrThrow(userId, tenantId);
        const roles = await this.prisma.role.findMany({ where: { id: { in: roleIds }, tenantId } });
        if (roles.length !== roleIds.length) {
            throw new common_1.BadRequestException('One or more roles do not belong to this tenant');
        }
        await this.prisma.userTenantRole.createMany({
            data: roleIds.map((roleId) => ({ userTenantId: membership.id, roleId })),
            skipDuplicates: true,
        });
        return { ok: true };
    }
    async removeRolesForUserInTenant(userId, tenantId, roleIds) {
        const membership = await this.getMembershipOrThrow(userId, tenantId);
        await this.prisma.userTenantRole.deleteMany({
            where: { userTenantId: membership.id, roleId: { in: roleIds } },
        });
        return { ok: true };
    }
    // --------- Membership (per-tenant) activation ---------
    async suspendMembership(userId, tenantId) {
        await this.getMembershipOrThrow(userId, tenantId);
        await this.prisma.userTenant.update({
            where: { userId_tenantId_unique: { userId, tenantId } },
            data: { status: 'suspended' },
        });
        return { ok: true };
    }
    async activateMembership(userId, tenantId) {
        await this.getMembershipOrThrow(userId, tenantId);
        await this.prisma.userTenant.update({
            where: { userId_tenantId_unique: { userId, tenantId } },
            data: { status: 'active' },
        });
        return { ok: true };
    }
    // --------- List members by tenant ---------
    async listMembersByTenant(tenantId, opts) {
        const page = Math.max(1, Number(opts?.page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(opts?.pageSize) || 20));
        const q = (opts?.search ?? '').trim();
        const whereMembership = {
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
        const data = rows.map((m) => ({
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
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        email_service_1.EmailService])
], UserService);
//# sourceMappingURL=user.service.js.map