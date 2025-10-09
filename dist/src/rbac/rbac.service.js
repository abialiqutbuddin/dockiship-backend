"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RbacService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../database/prisma.service");
let RbacService = class RbacService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    // ----------------- Helpers -----------------
    async assertRoleInTenant(roleId, tenantId) {
        const role = await this.prisma.role.findFirst({ where: { id: roleId, tenantId } });
        if (!role)
            throw new common_1.NotFoundException('Role not found for this tenant');
        return role;
    }
    async getPermissionIdsByNames(names) {
        const perms = await this.prisma.permission.findMany({ where: { name: { in: names } } });
        const foundNames = new Set(perms.map((p) => p.name));
        const missing = names.filter((n) => !foundNames.has(n));
        if (missing.length) {
            throw new common_1.BadRequestException(`Unknown permissions: ${missing.join(', ')}`);
        }
        return perms.map((p) => p.id);
    }
    async getMembershipOrThrow(userId, tenantId) {
        const membership = await this.prisma.userTenant.findUnique({
            where: { userId_tenantId_unique: { userId, tenantId } },
        });
        if (!membership)
            throw new common_1.NotFoundException('User is not a member of this tenant');
        return membership;
    }
    // ----------------- Roles (tenant-scoped) -----------------
    // Get role by name (tenant-scoped)
    getRoleByName(tenantId, name) {
        return this.prisma.role.findFirst({
            where: { tenantId, name },
            include: { rolePerms: { include: { permission: true } } },
        });
    }
    // Create role
    async createRole(tenantId, name, description) {
        try {
            const role = await this.prisma.role.create({
                data: { name, description, tenantId },
            });
            return role;
        }
        catch (e) {
            // respects @@unique([name, tenantId])
            if (e.code === 'P2002')
                throw new common_1.BadRequestException('Role with this name already exists');
            throw e;
        }
    }
    // Update role (rename / description)
    async updateRole(tenantId, roleId, data) {
        await this.assertRoleInTenant(roleId, tenantId);
        try {
            const role = await this.prisma.role.update({
                where: { id: roleId },
                data: { name: data.name, description: data.description },
            });
            return role;
        }
        catch (e) {
            if (e.code === 'P2002')
                throw new common_1.BadRequestException('Role with this name already exists');
            throw e;
        }
    }
    // Delete role (and its links)
    async deleteRole(tenantId, roleId) {
        await this.assertRoleInTenant(roleId, tenantId);
        await this.prisma.$transaction([
            this.prisma.rolePermission.deleteMany({ where: { roleId } }),
            this.prisma.userTenantRole.deleteMany({ where: { roleId } }),
            this.prisma.role.delete({ where: { id: roleId } }),
        ]);
        return { ok: true };
    }
    // Get all roles for a tenant
    async getAllRoles(tenantId) {
        const roles = await this.prisma.role.findMany({
            where: { tenantId },
            include: { rolePerms: { include: { permission: true } } },
            orderBy: { name: 'asc' },
        });
        return roles.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            permissions: r.rolePerms.map((rp) => rp.permission.name),
        }));
    }
    // Get role IDs only (lightweight)
    async getRoleIds(tenantId) {
        return this.prisma.role.findMany({
            where: { tenantId },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
    }
    // ----------------- Role ↔ Permission (global perms) -----------------
    async listPermissionsForRole(roleId, tenantId) {
        await this.assertRoleInTenant(roleId, tenantId);
        const links = await this.prisma.rolePermission.findMany({
            where: { roleId },
            include: { permission: true },
            orderBy: { permission: { name: 'asc' } },
        });
        return links.map((rp) => rp.permission.name);
    }
    // ADD permissions (keep existing)
    async addPermissionsToRole(roleId, tenantId, permissionNames) {
        await this.assertRoleInTenant(roleId, tenantId);
        const permissionIds = await this.getPermissionIdsByNames(permissionNames);
        await this.prisma.rolePermission.createMany({
            data: permissionIds.map((pid) => ({ roleId, permissionId: pid })),
            skipDuplicates: true, // relies on @@unique([roleId, permissionId])
        });
        return this.listPermissionsForRole(roleId, tenantId);
    }
    // REPLACE permissions (overwrite)
    async setPermissionsForRole(roleId, tenantId, permissionNames) {
        await this.assertRoleInTenant(roleId, tenantId);
        const permissionIds = await this.getPermissionIdsByNames(permissionNames);
        await this.prisma.$transaction([
            this.prisma.rolePermission.deleteMany({ where: { roleId } }),
            this.prisma.rolePermission.createMany({
                data: permissionIds.map((pid) => ({ roleId, permissionId: pid })),
                skipDuplicates: true,
            }),
        ]);
        return this.listPermissionsForRole(roleId, tenantId);
    }
    // REMOVE given permissions
    async removePermissionsFromRole(roleId, tenantId, permissionNames) {
        await this.assertRoleInTenant(roleId, tenantId);
        const permissionIds = await this.getPermissionIdsByNames(permissionNames);
        await this.prisma.rolePermission.deleteMany({
            where: { roleId, permissionId: { in: permissionIds } },
        });
        return this.listPermissionsForRole(roleId, tenantId);
    }
    // ----------------- Membership ↔ Role (UserTenantRole) -----------------
    /**
     * Set roles for a USER within a TENANT (replace set).
     * Finds the membership (UserTenant), then rewires UserTenantRole rows.
     */
    async setRolesForUserInTenant(userId, tenantId, roleIds) {
        // Ensure roles belong to tenant
        const roles = await this.prisma.role.findMany({ where: { id: { in: roleIds }, tenantId } });
        if (roles.length !== roleIds.length) {
            throw new common_1.BadRequestException('One or more roles do not belong to this tenant');
        }
        const membership = await this.getMembershipOrThrow(userId, tenantId);
        await this.prisma.$transaction([
            this.prisma.userTenantRole.deleteMany({ where: { userTenantId: membership.id } }),
            this.prisma.userTenantRole.createMany({
                data: roleIds.map((roleId) => ({ userTenantId: membership.id, roleId })),
            }),
        ]);
        return { ok: true };
    }
    /**
     * Add roles (keep existing) for a USER within a TENANT.
     */
    async addRolesForUserInTenant(userId, tenantId, roleIds) {
        const roles = await this.prisma.role.findMany({ where: { id: { in: roleIds }, tenantId } });
        if (roles.length !== roleIds.length) {
            throw new common_1.BadRequestException('One or more roles do not belong to this tenant');
        }
        const membership = await this.getMembershipOrThrow(userId, tenantId);
        await this.prisma.userTenantRole.createMany({
            data: roleIds.map((roleId) => ({ userTenantId: membership.id, roleId })),
            skipDuplicates: true, // relies on @@unique([userTenantId, roleId])
        });
        return { ok: true };
    }
    /**
     * Remove specific roles for a USER within a TENANT.
     */
    async removeRolesForUserInTenant(userId, tenantId, roleIds) {
        const membership = await this.getMembershipOrThrow(userId, tenantId);
        await this.prisma.userTenantRole.deleteMany({
            where: { userTenantId: membership.id, roleId: { in: roleIds } },
        });
        return { ok: true };
    }
    /**
     * List a USER's roles (names) within a TENANT.
     */
    async listUserRolesInTenant(userId, tenantId) {
        const membership = await this.getMembershipOrThrow(userId, tenantId);
        const rows = await this.prisma.userTenantRole.findMany({
            where: { userTenantId: membership.id },
            include: { role: true },
            orderBy: { role: { name: 'asc' } },
        });
        return rows.map((r) => r.role.name);
    }
};
exports.RbacService = RbacService;
exports.RbacService = RbacService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RbacService);
//# sourceMappingURL=rbac.service.js.map