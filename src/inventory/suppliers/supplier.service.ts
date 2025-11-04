import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { PrismaService } from '../../database/prisma.service';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SupplierService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateSupplierDto) {
    const exists = await this.prisma.supplier.findFirst({
      where: { tenantId, companyName: dto.companyName },
      select: { id: true },
    });
    if (exists) throw new ConflictException('Supplier with this company name already exists');

    return this.prisma.supplier.create({
      data: { tenantId, ...dto },
    });
  }

  async list(tenantId: string) {
    return this.prisma.supplier.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(tenantId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async update(tenantId: string, id: string, dto: UpdateSupplierDto) {
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
      if (dup) throw new ConflictException('Another supplier already uses this company name');
    }

    try {
      return await this.prisma.supplier.update({
        where: { id },
        data: { ...dto },
      });
    } catch {
      throw new NotFoundException('Supplier not found');
    }
  }

  async archive(tenantId: string, id: string) {
    // soft delete
    const supplier = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    return this.prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });
  }

   /** List products linked to a supplier (with small projection) */
  async listProducts(tenantId: string, supplierId: string, q?: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId, isActive: true },
      select: { id: true },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    return this.prisma.product.findMany({
      where: {
        tenantId,
        primarySupplierId: supplierId,
        ...(q
          ? {
              OR: [
                { name: { contains: q} },
                { sku: { contains: q} },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        //st: true,
        images: { take: 1, select: { url: true } },
      },
    });
  }

  /** Unlink product.supplierId (safe for tenant) */
  async unlinkProduct(tenantId: string, supplierId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: { id: true, primarySupplierId: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.primarySupplierId !== supplierId) {
      throw new ForbiddenException('Product is not linked to this supplier');
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: { primarySupplierId: null },
    });

    return { ok: true };
  }
  
}