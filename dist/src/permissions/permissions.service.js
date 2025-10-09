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
exports.PermissionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../database/prisma.service");
let PermissionsService = class PermissionsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    // 🔹 Get all permissions (global or tenant-specific)
    async getAll(tenantId) {
        // currently permissions are global — no tenantId needed
        const perms = await this.prisma.permission.findMany({
            orderBy: { name: 'asc' },
        });
        return perms.map((p) => ({
            id: p.id,
            name: p.name,
            module: p.name.split('.')[0], // e.g. inventory.create → inventory
            action: p.name.split('.')[1], // e.g. inventory.create → create
        }));
    }
};
exports.PermissionsService = PermissionsService;
exports.PermissionsService = PermissionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PermissionsService);
//# sourceMappingURL=permissions.service.js.map