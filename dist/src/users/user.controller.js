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
exports.UserController = void 0;
// src/users/user.controller.ts
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const rbac_guard_1 = require("../common/guards/rbac.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const permissions_decorator_1 = require("../common/decorators/permissions.decorator");
const tenant_decorator_1 = require("../common/decorators/tenant.decorator");
const user_service_1 = require("./user.service");
const invite_user_dto_1 = require("./dto/invite-user.dto");
const set_roles_dto_1 = require("./dto/set-roles.dto");
const create_user_dto_1 = require("./dto/create-user.dto");
let UserController = class UserController {
    constructor(users) {
        this.users = users;
    }
    async listMembers(tenantId, page, pageSize, search) {
        return this.users.listMembersByTenant(tenantId, {
            page: Number(page) || 1,
            pageSize: Number(pageSize) || 20,
            search,
        });
    }
    async invite(tenantId, dto) {
        return this.users.inviteUser({
            email: dto.email,
            fullName: dto.fullName,
            tenantId,
            roleIds: dto.roleIds,
        });
    }
    async createMember(tenantId, dto) {
        return this.users.createMemberWithPassword({
            tenantId,
            email: dto.email,
            fullName: dto.fullName,
            password: dto.password,
            roleIds: dto.roleIds,
        });
    }
    async setRoles(tenantId, userId, dto) {
        return this.users.setRolesForUserInTenant(userId, tenantId, dto.roleIds);
    }
    async addRoles(tenantId, userId, dto) {
        return this.users.addRolesForUserInTenant(userId, tenantId, dto.roleIds);
    }
    async removeRoles(tenantId, userId, dto) {
        return this.users.removeRolesForUserInTenant(userId, tenantId, dto.roleIds);
    }
    async suspendMembership(tenantId, userId) {
        return this.users.suspendMembership(userId, tenantId);
    }
    async activateMembership(tenantId, userId) {
        return this.users.activateMembership(userId, tenantId);
    }
};
exports.UserController = UserController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)('Admin', 'Owner'),
    (0, permissions_decorator_1.Permissions)('user.manage'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __param(3, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "listMembers", null);
__decorate([
    (0, common_1.Post)('invite'),
    (0, roles_decorator_1.Roles)('Admin', 'Owner'),
    (0, permissions_decorator_1.Permissions)('user.manage'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, invite_user_dto_1.InviteUserDto]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "invite", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('Admin', 'Owner'),
    (0, permissions_decorator_1.Permissions)('user.manage'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_user_dto_1.CreateMemberDto]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "createMember", null);
__decorate([
    (0, common_1.Put)(':userId/roles'),
    (0, roles_decorator_1.Roles)('Admin', 'Owner'),
    (0, permissions_decorator_1.Permissions)('user.manage', 'role.manage'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, set_roles_dto_1.SetRolesDto]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "setRoles", null);
__decorate([
    (0, common_1.Post)(':userId/roles/add'),
    (0, roles_decorator_1.Roles)('Admin', 'Owner'),
    (0, permissions_decorator_1.Permissions)('user.manage', 'role.manage'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, set_roles_dto_1.SetRolesDto]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "addRoles", null);
__decorate([
    (0, common_1.Delete)(':userId/roles'),
    (0, roles_decorator_1.Roles)('Admin', 'Owner'),
    (0, permissions_decorator_1.Permissions)('user.manage', 'role.manage'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, set_roles_dto_1.SetRolesDto]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "removeRoles", null);
__decorate([
    (0, common_1.Post)(':userId/suspend'),
    (0, roles_decorator_1.Roles)('Admin', 'Owner'),
    (0, permissions_decorator_1.Permissions)('user.manage'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "suspendMembership", null);
__decorate([
    (0, common_1.Post)(':userId/activate'),
    (0, roles_decorator_1.Roles)('Admin', 'Owner'),
    (0, permissions_decorator_1.Permissions)('user.manage'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __param(1, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "activateMembership", null);
exports.UserController = UserController = __decorate([
    (0, common_1.Controller)('users'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [user_service_1.UserService])
], UserController);
//# sourceMappingURL=user.controller.js.map