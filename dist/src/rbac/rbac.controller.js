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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RbacController = void 0;
// src/rbac/rbac.controller.ts
const common_1 = require("@nestjs/common");
const rbac_service_1 = require("./rbac.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const rbac_guard_1 = require("../common/guards/rbac.guard");
const permissions_decorator_1 = require("../common/decorators/permissions.decorator");
const tenant_decorator_1 = require("../common/decorators/tenant.decorator");
const create_role_dto_1 = require("./dto/create-role.dto");
const update_role_dto_1 = require("./dto/update-role.dto");
const update_role_permissions_dto_1 = require("./dto/update-role-permissions.dto");
const update_role_and_perm_dto_1 = require("./dto/update-role-and-perm.dto");
let RbacController = class RbacController {
    constructor(rbac) {
        this.rbac = rbac;
    }
    // Create role with optional permissions in one shot
    async createRole(tenantId, dto) {
        const role = await this.rbac.createRole(tenantId, dto.name, dto.description);
        if (dto.permissionNames?.length) {
            const perms = await this.rbac.setPermissionsForRole(role.id, tenantId, dto.permissionNames);
            return { ...role, permissions: perms };
        }
        // no perms provided -> empty list
        return { ...role, permissions: [] };
    }
    // Update role metadata
    async updateRole(tenantId, roleId, dto) {
        return this.rbac.updateRole(tenantId, roleId, dto);
    }
    // Delete role
    async deleteRole(tenantId, roleId) {
        return this.rbac.deleteRole(tenantId, roleId);
    }
    // List roles (with permissions)
    async listRoles(tenantId) {
        return this.rbac.getAllRoles(tenantId);
    }
    // Lightweight role ids
    async listRoleIds(tenantId) {
        return this.rbac.getRoleIds(tenantId);
    }
    // Get role permissions (names)
    async getRolePermissions(tenantId, roleId) {
        return this.rbac.listPermissionsForRole(roleId, tenantId);
    }
    // ADD permissions (keep existing)
    async addRolePermissions(tenantId, roleId, dto) {
        return this.rbac.addPermissionsToRole(roleId, tenantId, dto.permissionNames);
    }
    // REPLACE permissions (overwrite set)
    async setRolePermissions(tenantId, roleId, dto) {
        return this.rbac.setPermissionsForRole(roleId, tenantId, dto.permissionNames);
    }
    updateRoleAndPermissions(roleId, dto, tenantId) {
        return this.rbac.updateRoleAndPermissions(tenantId, roleId, dto);
    }
    // REMOVE specific permissions
    async removeRolePermissions(tenantId, roleId, dto) {
        return this.rbac.removePermissionsFromRole(roleId, tenantId, dto.permissionNames);
    }
};
exports.RbacController = RbacController;
__decorate([
    (0, common_1.Post)()
    // Pick ONE of these lines based on your policy:
    // @Roles('Admin','Owner')
    ,
    (0, permissions_decorator_1.Permissions)('role.manage'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_role_dto_1.CreateRoleDto]),
    __metadata("design:returntype", Promise)
], RbacController.prototype, "createRole", null);
__decorate([
    (0, common_1.Put)(':roleId'),
    (0, permissions_decorator_1.Permissions)('role.manage'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)('roleId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_role_dto_1.UpdateRoleDto]),
    __metadata("design:returntype", Promise)
], RbacController.prototype, "updateRole", null);
__decorate([
    (0, common_1.Delete)(':roleId'),
    (0, permissions_decorator_1.Permissions)('role.manage'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)('roleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], RbacController.prototype, "deleteRole", null);
__decorate([
    (0, common_1.Get)()
    // @Roles('Admin','Manager','Owner') // or:
    ,
    (0, permissions_decorator_1.Permissions)('role.manage'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RbacController.prototype, "listRoles", null);
__decorate([
    (0, common_1.Get)('ids')
    // @Roles('Admin','Manager','Owner') // or:
    ,
    (0, permissions_decorator_1.Permissions)('role.manage'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], RbacController.prototype, "listRoleIds", null);
__decorate([
    (0, common_1.Get)(':roleId/permissions'),
    (0, permissions_decorator_1.Permissions)('role.manage'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)('roleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], RbacController.prototype, "getRolePermissions", null);
__decorate([
    (0, common_1.Post)(':roleId/permissions/add'),
    (0, permissions_decorator_1.Permissions)('role.manage'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)('roleId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_role_permissions_dto_1.UpdateRolePermissionsDto]),
    __metadata("design:returntype", Promise)
], RbacController.prototype, "addRolePermissions", null);
__decorate([
    (0, common_1.Put)(':roleId/permissions'),
    (0, permissions_decorator_1.Permissions)('role.manage'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)('roleId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_role_permissions_dto_1.UpdateRolePermissionsDto]),
    __metadata("design:returntype", Promise)
], RbacController.prototype, "setRolePermissions", null);
__decorate([
    (0, common_1.Patch)(':roleId'),
    __param(0, (0, common_1.Param)('roleId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, tenant_decorator_1.TenantId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_role_and_perm_dto_1.UpdateRoleAndPermissionsDto, String]),
    __metadata("design:returntype", void 0)
], RbacController.prototype, "updateRoleAndPermissions", null);
__decorate([
    (0, common_1.Delete)(':roleId/permissions'),
    (0, permissions_decorator_1.Permissions)('role.manage'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)('roleId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_role_permissions_dto_1.UpdateRolePermissionsDto]),
    __metadata("design:returntype", Promise)
], RbacController.prototype, "removeRolePermissions", null);
exports.RbacController = RbacController = __decorate([
    (0, common_1.Controller)('roles'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [rbac_service_1.RbacService])
], RbacController);
//# sourceMappingURL=rbac.controller.js.map