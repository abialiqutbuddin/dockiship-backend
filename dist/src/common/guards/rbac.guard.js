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
exports.RbacGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const roles_decorator_1 = require("../decorators/roles.decorator");
const permissions_decorator_1 = require("../decorators/permissions.decorator");
const SUPER_ROLES = ['Owner', 'Admin'];
function hasPermission(requiredPerms, userPerms) {
    if (!requiredPerms?.length)
        return true;
    if (!userPerms?.length)
        return false;
    const userSet = new Set(userPerms);
    if (userSet.has('*'))
        return true;
    // Expand user perms to module wildcards: "inventory.read" -> also allow "inventory.*"
    const expanded = new Set();
    for (const p of userPerms) {
        expanded.add(p);
        const modulePart = p.split('.')[0];
        if (modulePart)
            expanded.add(`${modulePart}.*`);
    }
    // Match exact or by module wildcard on the REQUIRED side
    return requiredPerms.some((req) => {
        if (expanded.has(req))
            return true;
        const reqModule = req.split('.')[0];
        return !!reqModule && expanded.has(`${reqModule}.*`);
    });
}
let RbacGuard = class RbacGuard {
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(ctx) {
        const requiredRoles = this.reflector.getAllAndOverride(roles_decorator_1.ROLES_KEY, [
            ctx.getHandler(),
            ctx.getClass(),
        ]);
        const requiredPerms = this.reflector.getAllAndOverride(permissions_decorator_1.PERMS_KEY, [
            ctx.getHandler(),
            ctx.getClass(),
        ]);
        const req = ctx.switchToHttp().getRequest();
        const user = req.user;
        if (!user)
            throw new common_1.UnauthorizedException();
        const userRoles = user.roles ?? [];
        const userPerms = user.perms ?? [];
        // 1) Role check (if specified)
        if (requiredRoles?.length) {
            const ok = requiredRoles.some((role) => userRoles.includes(role));
            if (!ok)
                throw new common_1.ForbiddenException('Insufficient role');
        }
        // 2) SUPER ROLE bypass for permissions
        const isSuper = userRoles.some((r) => SUPER_ROLES.includes(r));
        // 3) Permission check (skip if super)
        if (!isSuper && requiredPerms?.length) {
            const ok = hasPermission(requiredPerms, userPerms);
            if (!ok)
                throw new common_1.ForbiddenException('Missing permission');
        }
        // 4) (Optional) enforce tenant header matches JWT tenant
        if (req.tenantId && user.tenantId && req.tenantId !== user.tenantId) {
            throw new common_1.ForbiddenException('Tenant mismatch');
        }
        return true;
    }
};
exports.RbacGuard = RbacGuard;
exports.RbacGuard = RbacGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], RbacGuard);
//# sourceMappingURL=rbac.guard.js.map