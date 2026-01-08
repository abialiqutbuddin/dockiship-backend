import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

interface ListQuery {
    search?: string;
    status?: 'active' | 'inactive' | '';
}

@Injectable()
export class OrderSettingsService {
    constructor(private readonly prisma: PrismaService) { }

    // =====================
    // Courier Mediums
    // =====================
    async getCourierMediums(tenantId: string, query: ListQuery = {}) {
        const { search, status } = query;
        const where: any = { tenantId };

        if (search) {
            where.OR = [
                { fullName: { contains: search } },
                { shortName: { contains: search } },
            ];
        }
        if (status === 'active') {
            where.isActive = true;
        } else if (status === 'inactive') {
            where.isActive = false;
        }

        return this.prisma.courierMedium.findMany({
            where,
            orderBy: { fullName: 'asc' },
        });
    }

    async createCourierMedium(tenantId: string, dto: { fullName: string; shortName: string }) {
        return this.prisma.courierMedium.create({
            data: { tenantId, ...dto },
        });
    }

    async updateCourierMedium(tenantId: string, id: string, dto: { fullName?: string; shortName?: string; isActive?: boolean }) {
        const exists = await this.prisma.courierMedium.findFirst({ where: { id, tenantId } });
        if (!exists) throw new NotFoundException('Courier medium not found');
        return this.prisma.courierMedium.update({
            where: { id },
            data: dto,
        });
    }

    async deleteCourierMedium(tenantId: string, id: string) {
        const exists = await this.prisma.courierMedium.findFirst({ where: { id, tenantId } });
        if (!exists) throw new NotFoundException('Courier medium not found');
        return this.prisma.courierMedium.delete({
            where: { id },
        });
    }

    // =====================
    // Remark Types
    // =====================
    async getRemarkTypes(tenantId: string, query: ListQuery = {}) {
        const { search, status } = query;
        const where: any = { tenantId };

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { description: { contains: search } },
            ];
        }
        if (status === 'active') {
            where.isActive = true;
        } else if (status === 'inactive') {
            where.isActive = false;
        }

        return this.prisma.remarkType.findMany({
            where,
            orderBy: { name: 'asc' },
        });
    }

    async createRemarkType(tenantId: string, dto: { name: string; description?: string }) {
        return this.prisma.remarkType.create({
            data: { tenantId, ...dto },
        });
    }

    async updateRemarkType(tenantId: string, id: string, dto: { name?: string; description?: string; isActive?: boolean }) {
        const exists = await this.prisma.remarkType.findFirst({ where: { id, tenantId } });
        if (!exists) throw new NotFoundException('Remark type not found');
        return this.prisma.remarkType.update({
            where: { id },
            data: dto,
        });
    }

    async deleteRemarkType(tenantId: string, id: string) {
        const exists = await this.prisma.remarkType.findFirst({ where: { id, tenantId } });
        if (!exists) throw new NotFoundException('Remark type not found');
        return this.prisma.remarkType.delete({
            where: { id },
        });
    }
}
