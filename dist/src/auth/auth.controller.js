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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const login_dto_1 = require("./dto/login.dto");
const register_owner_dto_1 = require("./dto/register-owner.dto");
const password_dto_1 = require("./dto/password.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
let AuthController = class AuthController {
    constructor(auth) {
        this.auth = auth;
    }
    // Owner register (global user only, no tenant)
    ownerRegister(dto) {
        return this.auth.ownerRegister(dto.email, dto.password, dto.fullName);
    }
    // Owner login — may return list of owned tenants if tenantId not provided
    ownerLogin(dto) {
        return this.auth.ownerLogin(dto.email, dto.password, dto.tenantId);
    }
    // Member login — if tenantId omitted, returns needTenantSelection + list; if provided, returns tenant-scoped token
    memberLogin(dto) {
        return this.auth.memberLogin(dto.email, dto.password, dto.tenantId);
    }
    // ---- Password reset (shared for owner/member) ----
    // 1) user enters email -> we email a short-lived tokenized link
    requestReset(dto) {
        return this.auth.requestPasswordReset(dto.email, dto.tenantId);
    }
    // 2) frontend calls with token + new password
    resetPassword(dto) {
        return this.auth.resetPassword(dto.token, dto.newPassword);
    }
    // Optional: logged-in users can change password without email links
    changePassword(dto) {
        return this.auth.changeOwnPassword(dto.currentPassword, dto.newPassword);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('owner/register'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_owner_dto_1.RegisterOwnerDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "ownerRegister", null);
__decorate([
    (0, common_1.Post)('owner/login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.OwnerLoginDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "ownerLogin", null);
__decorate([
    (0, common_1.Post)('member/login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.MemberLoginDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "memberLogin", null);
__decorate([
    (0, common_1.Post)('password/request'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [password_dto_1.RequestPasswordResetDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "requestReset", null);
__decorate([
    (0, common_1.Post)('password/reset'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [password_dto_1.ResetPasswordDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('password/change'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [password_dto_1.ChangePasswordDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "changePassword", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map