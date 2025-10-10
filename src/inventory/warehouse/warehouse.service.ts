import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { PrismaService } from '../../database/prisma.service';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Injectable()
export class WarehouseService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateWarehouseDto) {
    const exists = await this.prisma.warehouse.findFirst({
      where: { tenantId, code: dto.code },
      select: { id: true },
    });
    if (exists) throw new ConflictException('Warehouse code already exists for this tenant');

    return this.prisma.warehouse.create({
      data: { tenantId, ...dto },
    });
  }

  async list(tenantId: string) {
    return this.prisma.warehouse.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
    });
  }

  async getById(tenantId: string, id: string) {
    const wh = await this.prisma.warehouse.findFirst({ where: { id, tenantId } });
    if (!wh) throw new NotFoundException('Warehouse not found');
    return wh;
  }

  async update(tenantId: string, id: string, dto: UpdateWarehouseDto) {
    if (dto.code) {
      const dup = await this.prisma.warehouse.findFirst({
        where: { tenantId, code: dto.code, NOT: { id } },
        select: { id: true },
      });
      if (dup) throw new ConflictException('Another warehouse already uses this code');
    }

    try {
      return await this.prisma.warehouse.update({
        where: { id },
        data: { ...dto },
      });
    } catch {
      throw new NotFoundException('Warehouse not found');
    }
  }

  async archive(tenantId: string, id: string) {
    const wh = await this.prisma.warehouse.findFirst({ where: { id, tenantId } });
    if (!wh) throw new NotFoundException('Warehouse not found');

    return this.prisma.warehouse.update({
      where: { id },
      data: { isActive: false },
    });
  }
}