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
exports.WarehouseService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
let WarehouseService = class WarehouseService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(tenantId, dto) {
        const exists = await this.prisma.warehouse.findFirst({
            where: { tenantId, code: dto.code },
            select: { id: true },
        });
        if (exists)
            throw new common_1.ConflictException('Warehouse code already exists for this tenant');
        return this.prisma.warehouse.create({
            data: { tenantId, ...dto },
        });
    }
    async list(tenantId) {
        return this.prisma.warehouse.findMany({
            where: { tenantId, isActive: true },
            orderBy: [{ name: 'asc' }, { code: 'asc' }],
        });
    }
    async getById(tenantId, id) {
        const wh = await this.prisma.warehouse.findFirst({ where: { id, tenantId } });
        if (!wh)
            throw new common_1.NotFoundException('Warehouse not found');
        return wh;
    }
    async update(tenantId, id, dto) {
        if (dto.code) {
            const dup = await this.prisma.warehouse.findFirst({
                where: { tenantId, code: dto.code, NOT: { id } },
                select: { id: true },
            });
            if (dup)
                throw new common_1.ConflictException('Another warehouse already uses this code');
        }
        try {
            return await this.prisma.warehouse.update({
                where: { id },
                data: { ...dto },
            });
        }
        catch {
            throw new common_1.NotFoundException('Warehouse not found');
        }
    }
    async archive(tenantId, id) {
        const wh = await this.prisma.warehouse.findFirst({ where: { id, tenantId } });
        if (!wh)
            throw new common_1.NotFoundException('Warehouse not found');
        return this.prisma.warehouse.update({
            where: { id },
            data: { isActive: false },
        });
    }
};
exports.WarehouseService = WarehouseService;
exports.WarehouseService = WarehouseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WarehouseService);
//# sourceMappingURL=warehouse.service.js.map