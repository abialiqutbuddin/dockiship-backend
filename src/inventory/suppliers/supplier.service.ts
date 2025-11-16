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
    const suppliers = await this.prisma.supplier.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const ids = suppliers.map((s) => s.id);
    if (ids.length === 0) return suppliers;

    // Count products linked via ProductSupplier join (supports multi-supplier)
    const grouped = await this.prisma.productSupplier.groupBy({
      by: ['supplierId'],
      where: { tenantId, supplierId: { in: ids } },
      _count: { _all: true },
    });
    const countMap: Record<string, number> = Object.fromEntries(
      grouped.map((g) => [g.supplierId as string, (g._count as any)._all as number])
    );

    return suppliers.map((s) => ({
      ...s,
      productsCount: countMap[s.id] || 0,
    }));
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

    const links = await this.prisma.productSupplier.findMany({
      where: {
        tenantId,
        supplierId,
        product: q
          ? {
              OR: [
                { name: { contains: q } },
                { sku: { contains: q } },
              ],
            }
          : undefined,
      },
      orderBy: { product: { createdAt: 'desc' } },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            images: { take: 1, select: { url: true } },
          },
        },
      },
    });

    // Normalize response to array of product-like items (as frontend expects)
    return links.map((link) => ({
      id: link.product?.id,
      name: link.product?.name,
      sku: link.product?.sku || "",
      images: link.product?.images || [],
    }));
  }

  /** Unlink product.supplierId (safe for tenant) */
  async unlinkProduct(tenantId: string, supplierId: string, productId: string) {
    // ensure both belong to tenant
    const [supplier, product] = await Promise.all([
      this.prisma.supplier.findFirst({ where: { id: supplierId, tenantId }, select: { id: true } }),
      this.prisma.product.findFirst({ where: { id: productId, tenantId }, select: { id: true } }),
    ]);
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (!product) throw new NotFoundException('Product not found');

    await this.prisma.productSupplier.deleteMany({
      where: { tenantId, supplierId, productId },
    });

    return { ok: true };
  }

  /** Link products (bulk) to supplier through join table */
  async linkProducts(
    tenantId: string,
    supplierId: string,
    productIds: string[],
    opts: { lastPurchasePrice?: number; currency?: string } = {}
  ) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id: supplierId, tenantId }, select: { id: true } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    const ids = Array.isArray(productIds) ? [...new Set(productIds)].filter(Boolean) : [];
    if (ids.length === 0) return { ok: true, linked: 0 };

    // ensure products belong to tenant
    const products = await this.prisma.product.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true } });
    const validIds = products.map((p) => p.id);
    if (validIds.length === 0) return { ok: true, linked: 0 };

    // create many, ignore duplicates via unique constraint
    await this.prisma.productSupplier.createMany({
      data: validIds.map((pid) => ({ tenantId, supplierId, productId: pid })),
      skipDuplicates: true,
    });

    // Optional: set per-supplier price for these links
    if (opts.lastPurchasePrice != null || opts.currency) {
      for (const pid of validIds) {
        await this.prisma.productSupplier.updateMany({
          where: { tenantId, supplierId, productId: pid },
          data: {
            lastPurchasePrice: (opts.lastPurchasePrice as any) ?? undefined,
            lastPurchaseCurr: opts.currency ?? undefined,
          },
        });
      }
    }

    return { ok: true, linked: validIds.length };
  }

}
