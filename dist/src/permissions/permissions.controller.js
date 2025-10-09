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
exports.PermissionsController = void 0;
const common_1 = require("@nestjs/common");
const permissions_service_1 = require("./permissions.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const rbac_guard_1 = require("../common/guards/rbac.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const permissions_decorator_1 = require("../common/decorators/permissions.decorator");
const tenant_decorator_1 = require("../common/decorators/tenant.decorator");
let PermissionsController = class PermissionsController {
    constructor(perms) {
        this.perms = perms;
    }
    async listAll(tenantId) {
        return this.perms.getAll(tenantId);
    }
};
exports.PermissionsController = PermissionsController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)('Admin', 'Manager', 'Owner'),
    (0, permissions_decorator_1.Permissions)('role.manage', 'user.manage'),
    __param(0, (0, tenant_decorator_1.TenantId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PermissionsController.prototype, "listAll", null);
exports.PermissionsController = PermissionsController = __decorate([
    (0, common_1.Controller)('permissions'),
    (0, common_1.UseGuards)(tenant_guard_1.TenantGuard, jwt_auth_guard_1.JwtAuthGuard, rbac_guard_1.RbacGuard),
    __metadata("design:paramtypes", [permissions_service_1.PermissionsService])
], PermissionsController);
//# sourceMappingURL=permissions.controller.js.map