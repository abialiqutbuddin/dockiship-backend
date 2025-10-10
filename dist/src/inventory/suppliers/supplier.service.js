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
exports.SupplierService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
let SupplierService = class SupplierService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(tenantId, dto) {
        const exists = await this.prisma.supplier.findFirst({
            where: { tenantId, companyName: dto.companyName },
            select: { id: true },
        });
        if (exists)
            throw new common_1.ConflictException('Supplier with this company name already exists');
        return this.prisma.supplier.create({
            data: { tenantId, ...dto },
        });
    }
    async list(tenantId) {
        return this.prisma.supplier.findMany({
            where: { tenantId, isActive: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getById(tenantId, id) {
        const supplier = await this.prisma.supplier.findFirst({
            where: { id, tenantId },
        });
        if (!supplier)
            throw new common_1.NotFoundException('Supplier not found');
        return supplier;
    }
    async update(tenantId, id, dto) {
        // if changing name, enforce uniqueness per-tenant
        if (dto.companyName) {
            const dup = await this.prisma.supplier.findFirst({
                where: {
                    tenantId,
                    companyName: dto.companyName,
                    NOT: { id },
                },
                select: { id: true },
            });
            if (dup)
                throw new common_1.ConflictException('Another supplier already uses this company name');
        }
        try {
            return await this.prisma.supplier.update({
                where: { id },
                data: { ...dto },
            });
        }
        catch {
            throw new common_1.NotFoundException('Supplier not found');
        }
    }
    async archive(tenantId, id) {
        // soft delete
        const supplier = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
        if (!supplier)
            throw new common_1.NotFoundException('Supplier not found');
        return this.prisma.supplier.update({
            where: { id },
            data: { isActive: false },
        });
    }
};
exports.SupplierService = SupplierService;
exports.SupplierService = SupplierService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SupplierService);
//# sourceMappingURL=supplier.service.js.map