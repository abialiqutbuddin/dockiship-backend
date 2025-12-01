import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { PrismaService } from '../../database/prisma.service';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Injectable()
export class WarehouseService {
  constructor(private prisma: PrismaService) { }

  async create(tenantId: string, dto: CreateWarehouseDto) {
    let code = dto.code?.trim();
    if (code) {
      const exists = await this.prisma.warehouse.findFirst({
        where: { tenantId, code },
        select: { id: true },
      });
      if (exists) throw new ConflictException('Warehouse code already exists for this tenant');
    } else {
      code = await this.generateWarehouseCode(tenantId, dto.name);
    }

    const payload = this.sanitizeWarehouseData(dto);
    const name = payload.name ?? dto.name?.trim();
    if (!name) {
      throw new ConflictException('Warehouse name is required');
    }

    return this.prisma.warehouse.create({
      data: {
        tenantId,
        code,
        ...payload,
        name,
      },
    });
  }

  async list(tenantId: string, query: any = {}) {
    const where: any = { tenantId };

    if (query.status === 'active') {
      where.isActive = true;
    } else if (query.status === 'inactive') {
      where.isActive = false;
    }

    if (query.search) {
      const s = query.search.trim();
      if (s) {
        where.OR = [
          { name: { contains: s } },
          { code: { contains: s } },
        ];
      }
    }

    return this.prisma.warehouse.findMany({
      where,
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

    const payload = this.sanitizeWarehouseData(dto);
    if (dto.code != null) payload.code = dto.code.trim();
    if (dto.isActive != null) payload.isActive = dto.isActive;

    try {
      return await this.prisma.warehouse.update({
        where: { id },
        data: payload,
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

  private sanitizeWarehouseData(dto: Partial<CreateWarehouseDto & UpdateWarehouseDto>) {
    const trim = (val?: string | null) => {
      if (typeof val !== 'string') return undefined;
      const next = val.trim();
      return next ? next : undefined;
    };
    const payload: Record<string, any> = {};
    if (dto.name !== undefined) payload.name = trim(dto.name);
    if (dto.address1 !== undefined) payload.address1 = trim(dto.address1);
    if (dto.address2 !== undefined) payload.address2 = trim(dto.address2);
    if (dto.zipCode !== undefined) payload.zipCode = trim(dto.zipCode);
    if (dto.city !== undefined) payload.city = trim(dto.city);
    if (dto.state !== undefined) payload.state = trim(dto.state);
    if (dto.country !== undefined) {
      const normalized = trim(dto.country);
      payload.country = normalized ? normalized.toUpperCase() : undefined;
    }
    return payload;
  }

  private async generateWarehouseCode(tenantId: string, name?: string) {
    const baseRaw = (name || 'WH').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const base = baseRaw || 'WH';

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
      const candidate = `${base}${suffix}`.slice(0, 20);
      const exists = await this.prisma.warehouse.findFirst({
        where: { tenantId, code: candidate },
        select: { id: true },
      });
      if (!exists) {
        return candidate;
      }
    }

    return `WH-${Date.now().toString(36).toUpperCase()}`.slice(0, 20);
  }

  async getWarehouseStock(tenantId: string, id: string) {
    // Fetch warehouse details
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, tenantId },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    // Aggregate stock by product variant for this warehouse
    const txns = await this.prisma.inventoryTxn.findMany({
      where: {
        tenantId,
        warehouseId: id,
        state: 'ON_HAND',
      },
      select: {
        productVariantId: true,
        qtyDelta: true,
        productVar: {
          select: {
            id: true,
            sku: true,
            sizeText: true,
            colorText: true,
            stockOnHand: true,
            productId: true,
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                images: {
                  select: {
                    id: true,
                    url: true,
                    alt: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Group by variant and sum quantities
    const stockMap = new Map();
    for (const txn of txns) {
      if (!txn.productVariantId || !txn.productVar) continue;

      const key = txn.productVariantId;
      if (stockMap.has(key)) {
        stockMap.get(key).quantity += txn.qtyDelta;
      } else {
        stockMap.set(key, {
          productVariantId: txn.productVariantId,
          productId: txn.productVar.productId,
          variant: txn.productVar,
          quantity: txn.qtyDelta,
        });
      }
    }

    // Convert map to array and filter out zero/negative stock
    const stock = Array.from(stockMap.values())
      .filter(item => item.quantity > 0)
      .map(item => ({
        productVariantId: item.productVariantId,
        productId: item.productId,
        product: item.variant.product,
        productVariant: {
          id: item.variant.id,
          sku: item.variant.sku,
          sizeText: item.variant.sizeText,
          colorText: item.variant.colorText,
        },
        quantity: item.quantity,
      }));

    return {
      warehouse,
      stock,
    };
  }
}
