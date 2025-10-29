// ---------------------------------------------
// src/products/products.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProductDto, CreateVariantDto } from './dto/create-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { ListProductsQueryDto } from './dto/list-products.dto';
import { ProductStatus, ProductCondition, WeightUnit, LengthUnit } from '@prisma/client';

@Injectable()
export class ProductsService {
    constructor(private readonly prisma: PrismaService) { }

    // helpers
    private ensureTenantMatch(tenantIdFromReq: string, tenantIdFromEntity?: string) {
        if (tenantIdFromEntity && tenantIdFromEntity !== tenantIdFromReq) {
            throw new BadRequestException('Tenant mismatch');
        }
    }

    // CREATE PRODUCT (with optional variants)
    // CREATE PRODUCT (with variant logic)
    async createProduct(tenantId: string, dto: CreateProductDto) {
        const { variants, ...productData } = dto;

        const exists = await this.prisma.product.findFirst({ where: { tenantId, sku: dto.sku } });
        if (exists) throw new BadRequestException('Parent SKU already exists for tenant');

        return this.prisma.product.create({
            data: {
                tenantId,
                sku: productData.sku,
                name: productData.name,
                brand: productData.brand ?? null,
                status: productData.status,
                originCountry: productData.originCountry ?? null,
                isDraft: productData.isDraft ?? false,
                publishedAt: productData.publishedAt ?? null,
                primarySupplierId: productData.primarySupplierId ?? null,
                // REMOVED: retailPrice, weight, condition, etc. from here

                ProductVariant: {
                    create: (variants && variants.length > 0)
                        ?   // CASE 1: Variants are provided (Variant Product)
                            variants.map((v) => ({
                                sku: v.sku,
                                sizeId: v.sizeId,
                                sizeText: v.sizeText,
                                barcode: v.barcode,
                                status: v.status ?? productData.status, // Inherit parent status
                                condition: v.condition ?? productData.condition, // Inherit parent condition
                                isDraft: v.isDraft ?? productData.isDraft, // Inherit
                                publishedAt: v.publishedAt ?? productData.publishedAt, // Inherit
                                weight: v.weight as any,
                                weightUnit: v.weightUnit,
                                length: v.length as any,
                                width: v.width as any,
                                height: v.height as any,
                                dimensionUnit: v.dimensionUnit,
                                attributes: v.attributes as any,
                                // Add price from variant DTO
                                retailPrice: v.retailPrice as any,
                                retailCurrency: v.retailCurrency,
                                originalPrice: v.originalPrice as any,
                                originalCurrency: v.originalCurrency,
                                // Stock fields default to 0
                            }))
                        :   // CASE 2: No variants provided (Simple Product)
                            // Create one default variant using the parent SKU and data
                            [{
                                sku: productData.sku, // Use parent SKU for the single variant
                                status: productData.status,
                                condition: productData.condition,
                                isDraft: productData.isDraft,
                                publishedAt: productData.publishedAt,
                                // Use parent-level data
                                weight: productData.weight as any,
                                weightUnit: productData.weightUnit,
                                length: productData.length as any,
                                width: productData.width as any,
                                height: productData.height as any,
                                dimensionUnit: productData.dimensionUnit,
                                // Use parent-level price
                                retailPrice: productData.retailPrice as any,
                                retailCurrency: productData.retailCurrency,
                                originalPrice: productData.originalPrice as any,
                                originalCurrency: productData.originalCurrency,
                                // Stock fields default to 0
                            }],
                },
            },
            include: { ProductVariant: true },
        });
    }
    // async createProduct(tenantId: string, dto: CreateProductDto) {
    //     const exists = await this.prisma.product.findFirst({ where: { tenantId, sku: dto.sku } });
    //     if (exists) throw new BadRequestException('SKU already exists for tenant');

    //     return this.prisma.product.create({
    //         data: {
    //             tenantId,
    //             sku: dto.sku,
    //             name: dto.name,
    //             brand: dto.brand ?? null,
    //             status: dto.status,
    //             originCountry: dto.originCountry ?? null,
    //             condition: dto.condition,
    //             weight: dto.weight as any,
    //             weightUnit: dto.weightUnit,
    //             length: dto.length as any,
    //             width: dto.width as any,
    //             height: dto.height as any,
    //             dimensionUnit: dto.dimensionUnit,
    //             isDraft: dto.isDraft ?? false,
    //             publishedAt: dto.publishedAt ?? null,
    //             retailPrice: dto.retailPrice as any,
    //             retailCurrency: dto.retailCurrency ?? null,
    //             originalPrice: dto.originalPrice as any,
    //             originalCurrency: dto.originalCurrency ?? null,
    //             primarySupplierId: dto.primarySupplierId ?? null,
    //             ProductVariant: dto.variants && dto.variants.length
    //                 ? {
    //                     create: dto.variants.map((v) => ({
    //                         sku: v.sku,
    //                         sizeId: v.sizeId,
    //                         sizeText: v.sizeText,
    //                         barcode: v.barcode,
    //                         status: v.status,
    //                         condition: v.condition,
    //                         isDraft: v.isDraft ?? false,
    //                         publishedAt: v.publishedAt ?? null,
    //                         weight: v.weight as any,
    //                         weightUnit: v.weightUnit,
    //                         length: v.length as any,
    //                         width: v.width as any,
    //                         height: v.height as any,
    //                         dimensionUnit: v.dimensionUnit,
    //                         attributes: v.attributes as any,
    //                     })),
    //                 }
    //                 : undefined,
    //         },
    //         include: { ProductVariant: true },
    //     });
    // }

    // LIST PRODUCTS (paginated)
    // src/products/products.service.ts

    async listProducts(tenantId: string, q: ListProductsQueryDto) {
        const { page = 1, perPage = 20, search, status } = q;
        const where: any = { tenantId };
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } }, // Searches parent SKU
                { brand: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [products, total] = await this.prisma.$transaction([
            this.prisma.product.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * perPage,
                take: perPage,
                include: {
                    // We must fetch the data we need to aggregate
                    ProductVariant: {
                        select: {
                            id: true,
                            sku: true,
                            status: true,
                            retailPrice: true, // This is a Decimal
                            stockOnHand: true, // <-- FIX 1: Use the correct field name
                        },
                    },
                    primarySupplier: { select: { id: true, companyName: true } },
                },
            }),
            this.prisma.product.count({ where }),
        ]);

        // ******* THIS IS THE NEW, IMPORTANT PART *******
        // We must transform the data for the admin table
        const items = products.map((product) => {
            const { ProductVariant, ...parentProduct } = product;
            const variantCount = ProductVariant.length;

            let displayType = 'Simple';
            let displayPrice = 'N/A';
            let displayStock = 'N/A';

            if (variantCount === 1) {
                // SIMPLE PRODUCT (Product with one variant)
                const variant = ProductVariant[0];
                displayType = 'Simple';
                // Note: .toString() handles Decimal type from Prisma
                displayPrice = variant.retailPrice ? `$${variant.retailPrice.toString()}` : 'N/A';
                displayStock = `${variant.stockOnHand || 0} in stock`;

            } else if (variantCount > 1) {
                // VARIANT PRODUCT
                displayType = `Variant (${variantCount})`;

                // Calculate price range
                const prices = ProductVariant
                    .map((v: { retailPrice: any; }) => v.retailPrice)
                    .filter((p: null) => p !== null) as number[]; // Filter out nulls

                if (prices.length > 0) {
                    const minPrice = Math.min(...prices);
                    const maxPrice = Math.max(...prices);
                    displayPrice = minPrice === maxPrice 
                        ? `$${minPrice.toString()}` 
                        : `$${minPrice.toString()} - $${maxPrice.toString()}`;
                }

                // Calculate total stock
                const totalStock = ProductVariant
                    .map((v: { stockOnHand: any; }) => v.stockOnHand || 0)
                    .reduce((sum: any, current: any) => sum + current, 0);
                
                displayStock = `${totalStock} across ${variantCount} variants`;
            }

            // Return the transformed product object for the API response
            return {
                ...parentProduct,
                type: displayType,     // e.g., "Variant (6)"
                price: displayPrice,   // e.g., "$19.99 - $21.99"
                stock: displayStock,   // e.g., "240 across 6 variants"
                variants: ProductVariant, // You can still send the minimal variant info
            };
        });

        return {
            page,
            perPage,
            total,
            totalPages: Math.ceil(total / perPage),
            items, // Send the new transformed items
        };
    }

// GET ONE PRODUCT (with simple/variant logic)
async getProduct(tenantId: string, productId: string) {
  const product = await this.prisma.product.findFirst({
    where: { id: productId, tenantId },
    include: {
      _count: { select: { ProductVariant: true } },
      ProductVariant: true,
      barcodes: true,
      images: true,
      tagLinks: { include: { tag: true } },
      supplierLinks: { include: { supplier: true } },
      primarySupplier: true,
    },
  });

  if (!product) throw new NotFoundException('Product not found');

  const variantCount = product._count?.ProductVariant ?? product.ProductVariant.length;
  let kind: 'simple' | 'variant' = 'simple';

  if (variantCount > 1) {
    kind = 'variant';
  } else if (variantCount === 1) {
    const v = product.ProductVariant[0];
    const hasSizeish =
      !!v.sizeId ||
      !!v.sizeText ||
      (v.attributes && Object.keys(v.attributes as any).length > 0);
    const looksSimple = v.sku === product.sku && !hasSizeish;
    kind = looksSimple ? 'simple' : 'variant';
  }

  const type = kind === 'simple' ? 'Simple' : `Variant (${variantCount})`;

  // If it's a simple product → flatten the variant fields into the parent
  if (kind === 'simple' && variantCount === 1) {
    const v = product.ProductVariant[0];
    const {
      id: variantId,
      sku,
      status,
      condition,
      weight,
      weightUnit,
      length,
      width,
      height,
      dimensionUnit,
      retailPrice,
      retailCurrency,
      originalPrice,
      originalCurrency,
      stockOnHand,
      stockReserved,
      stockInTransit,
      attributes,
      ...restVariant
    } = v;

    return {
      ...product,
      // overwrite ProductVariant section
      ProductVariant: undefined,
      variantId,
      sku,
      status,
      condition,
      weight,
      weightUnit,
      length,
      width,
      height,
      dimensionUnit,
      retailPrice,
      retailCurrency,
      originalPrice,
      originalCurrency,
      stockOnHand,
      stockReserved,
      stockInTransit,
      attributes,
      kind,
      type,
      variantCount,
    };
  }

  // Otherwise (variant product), return normally
  return {
    ...product,
    kind,
    type,
    variantCount,
  };
}
    // async listProducts(tenantId: string, q: ListProductsQueryDto) {
    //     const { page = 1, perPage = 20, search, status } = q;
    //     const where: any = { tenantId };
    //     if (status) where.status = status;
    //     if (search) {
    //         where.OR = [
    //             { name: { contains: search, mode: 'insensitive' } },
    //             { sku: { contains: search, mode: 'insensitive' } },
    //             { brand: { contains: search, mode: 'insensitive' } },
    //         ];
    //     }

    //     const [items, total] = await this.prisma.$transaction([
    //         this.prisma.product.findMany({
    //             where,
    //             orderBy: { createdAt: 'desc' },
    //             skip: (page - 1) * perPage,
    //             take: perPage,
    //             include: {
    //                 ProductVariant: { select: { id: true, sku: true, status: true } },
    //                 primarySupplier: { select: { id: true, companyName: true } },
    //             },
    //         }),
    //         this.prisma.product.count({ where }),
    //     ]);

    //     return {
    //         page,
    //         perPage,
    //         total,
    //         totalPages: Math.ceil(total / perPage),
    //         items,
    //     };
    // }

    // GET ONE PRODUCT (with relations)
    // async getProduct(tenantId: string, productId: string) {
    //     const product = await this.prisma.product.findFirst({
    //         where: { id: productId, tenantId },
    //         include: {
    //             ProductVariant: true,
    //             barcodes: true,
    //             images: true,
    //             tagLinks: { include: { tag: true } },
    //             supplierLinks: { include: { supplier: true } },
    //             primarySupplier: true,
    //         },
    //     });
    //     if (!product) throw new NotFoundException('Product not found');
    //     return product;
    // }

    // UPDATE PRODUCT
    // UPDATE PRODUCT (Parent fields only)
    async updateProduct(tenantId: string, productId: string, dto: UpdateProductDto) {
        const found = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
        if (!found) throw new NotFoundException('Product not found');

        // This DTO (UpdateProductDto) can contain price/weight fields
        // We MUST explicitly ignore them here.
        // Only update fields that belong to the parent Product.
        return this.prisma.product.update({
            where: { id: productId },
            data: {
                // Parent-level fields are OK to update
                sku: dto.sku,
                name: dto.name,
                brand: dto.brand,
                status: dto.status,
                originCountry: dto.originCountry,
                isDraft: dto.isDraft,
                publishedAt: dto.publishedAt,
                primarySupplierId: dto.primarySupplierId,

                // DO NOT UPDATE:
                // retailPrice, weight, condition, etc.
                // These must be updated via updateVariant()
            },
            include: { ProductVariant: true }, // Include variants to return the full object
        });
    }
    // async updateProduct(tenantId: string, productId: string, dto: UpdateProductDto) {
    //     const found = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
    //     if (!found) throw new NotFoundException('Product not found');

    //     return this.prisma.product.update({
    //         where: { id: productId },
    //         data: {
    //             sku: dto.sku,
    //             name: dto.name,
    //             brand: dto.brand,
    //             status: dto.status,
    //             originCountry: dto.originCountry,
    //             condition: dto.condition,
    //             weight: (dto as any).weight,
    //             weightUnit: dto.weightUnit,
    //             length: (dto as any).length,
    //             width: (dto as any).width,
    //             height: (dto as any).height,
    //             dimensionUnit: dto.dimensionUnit,
    //             isDraft: dto.isDraft,
    //             publishedAt: dto.publishedAt,
    //             retailPrice: (dto as any).retailPrice,
    //             retailCurrency: dto.retailCurrency,
    //             originalPrice: (dto as any).originalPrice,
    //             originalCurrency: dto.originalCurrency,
    //             primarySupplierId: dto.primarySupplierId,
    //         },
    //         include: { ProductVariant: true },
    //     });
    // }

    // DELETE PRODUCT (hard)
    async deleteProduct(tenantId: string, productId: string) {
        const found = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
        if (!found) throw new NotFoundException('Product not found');
        await this.prisma.product.delete({ where: { id: productId } });
        return { ok: true };
    }

    // PUBLISH / UNPUBLISH
    async publish(tenantId: string, productId: string) {
        const found = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
        if (!found) throw new NotFoundException('Product not found');
        return this.prisma.product.update({ where: { id: productId }, data: { isDraft: false, publishedAt: new Date() } });
    }
    async unpublish(tenantId: string, productId: string) {
        const found = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
        if (!found) throw new NotFoundException('Product not found');
        return this.prisma.product.update({ where: { id: productId }, data: { isDraft: true, publishedAt: null } });
    }

    // VARIANTS CRUD ---------------------------------
    async addVariant(tenantId: string, productId: string, dto: CreateVariantDto) {
        const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
        if (!product) throw new NotFoundException('Product not found');
        const exists = await this.prisma.productVariant.findFirst({ where: { productId, sku: dto.sku } });
        if (exists) throw new BadRequestException('Variant SKU already exists for product');

        return this.prisma.productVariant.create({
            data: {
                productId,
                sku: dto.sku,
                sizeId: dto.sizeId,
                sizeText: dto.sizeText,
                barcode: dto.barcode,
                status: dto.status,
                condition: dto.condition,
                isDraft: dto.isDraft ?? false,
                publishedAt: dto.publishedAt ?? null,
                weight: dto.weight as any,
                weightUnit: dto.weightUnit,
                length: dto.length as any,
                width: dto.width as any,
                height: dto.height as any,
                dimensionUnit: dto.dimensionUnit,
                attributes: dto.attributes as any,
                // Add price fields
                retailPrice: dto.retailPrice as any,
                retailCurrency: dto.retailCurrency,
                originalPrice: dto.originalPrice as any,
                originalCurrency: dto.originalCurrency,
            },
        });
    }

    // ProductsService

async updateVariant(
  tenantId: string,
  productId: string,
  variantId: string,
  dto: UpdateVariantDto
) {
  // Ensure product exists and belongs to tenant
  const product = await this.prisma.product.findFirst({
    where: { id: productId, tenantId },
    select: { id: true, tenantId: true },
  });
  if (!product) throw new NotFoundException('Product not found');

  const isCreateIntent = !variantId || variantId === 'new' || variantId === 'create';

  // Try to find the variant by id (when not explicitly create-intent)
  const existing = !isCreateIntent
    ? await this.prisma.productVariant.findFirst({
        where: { id: variantId, productId },
      })
    : null;

  // ---------- CREATE PATH ----------
  if (isCreateIntent || !existing) {
    if (!dto?.sku) {
      throw new BadRequestException('SKU is required to create a variant');
    }

    // Enforce SKU uniqueness within the product
    const skuClash = await this.prisma.productVariant.findFirst({
      where: { productId, sku: dto.sku },
      select: { id: true },
    });
    if (skuClash) {
      throw new BadRequestException('Variant SKU already exists for product');
    }

    const created = await this.prisma.productVariant.create({
      data: {
        productId,
        sku: dto.sku,
        sizeId: dto.sizeId,
        sizeText: dto.sizeText,
        barcode: dto.barcode,
        status: dto.status,
        condition: dto.condition,
        isDraft: dto.isDraft ?? false,
        publishedAt: dto.publishedAt ?? null,
        weight: (dto as any).weight,
        weightUnit: dto.weightUnit,
        length: (dto as any).length,
        width: (dto as any).width,
        height: (dto as any).height,
        dimensionUnit: dto.dimensionUnit,
        attributes: (dto as any).attributes,
        retailPrice: (dto as any).retailPrice,
        retailCurrency: dto.retailCurrency,
        originalPrice: (dto as any).originalPrice,
        originalCurrency: dto.originalCurrency,
      },
    });

    return { action: 'created', variant: created };
  }

  // ---------- UPDATE PATH ----------
  // If SKU changes, enforce uniqueness
  if (dto?.sku && dto.sku !== existing.sku) {
    const skuClash = await this.prisma.productVariant.findFirst({
      where: { productId, sku: dto.sku },
      select: { id: true },
    });
    if (skuClash) {
      throw new BadRequestException('Variant SKU already exists for product');
    }
  }

  const updated = await this.prisma.productVariant.update({
    where: { id: existing.id },
    data: {
      sku: dto.sku,
      sizeId: dto.sizeId,
      sizeText: dto.sizeText,
      barcode: dto.barcode,
      status: dto.status,
      condition: dto.condition,
      isDraft: dto.isDraft,
      publishedAt: dto.publishedAt,
      weight: (dto as any).weight,
      weightUnit: dto.weightUnit,
      length: (dto as any).length,
      width: (dto as any).width,
      height: (dto as any).height,
      dimensionUnit: dto.dimensionUnit,
      attributes: (dto as any).attributes,
      retailPrice: (dto as any).retailPrice,
      retailCurrency: dto.retailCurrency,
      originalPrice: (dto as any).originalPrice,
      originalCurrency: dto.originalCurrency,
    },
  });

  return { action: 'updated', variant: updated };
}

    // async updateVariant(tenantId: string, productId: string, variantId: string, dto: UpdateVariantDto) {
    //     const variant = await this.prisma.productVariant.findFirst({
    //         where: { id: variantId, productId, product: { tenantId } },
    //     });
    //     if (!variant) throw new NotFoundException('Variant not found');

    //     return this.prisma.productVariant.update({
    //         where: { id: variantId },
    //         data: {
    //             sku: dto.sku,
    //             sizeId: dto.sizeId,
    //             sizeText: dto.sizeText,
    //             barcode: dto.barcode,
    //             status: dto.status,
    //             condition: dto.condition,
    //             isDraft: dto.isDraft,
    //             publishedAt: dto.publishedAt,
    //             weight: (dto as any).weight,
    //             weightUnit: dto.weightUnit,
    //             length: (dto as any).length,
    //             width: (dto as any).width,
    //             height: (dto as any).height,
    //             dimensionUnit: dto.dimensionUnit,
    //             attributes: dto.attributes as any,
    //             // Add price fields
    //             retailPrice: (dto as any).retailPrice,
    //             retailCurrency: dto.retailCurrency,
    //             originalPrice: (dto as any).originalPrice,
    //             originalCurrency: dto.originalCurrency,
    //         },
    //     });
    // }

    async removeVariant(tenantId: string, productId: string, variantId: string) {
        const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, productId, product: { tenantId } } });
        if (!variant) throw new NotFoundException('Variant not found');
        await this.prisma.productVariant.delete({ where: { id: variantId } });
        return { ok: true };
    }

    // ENUM / SIZE HELPERS ---------------------------
    async listSizes(tenantId: string, search?: string) {
        return this.prisma.size.findMany({
            where: {
                tenantId,
                ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }] } : {}),
            },
            orderBy: [{ sort: 'asc' }, { code: 'asc' }],
        });
    }

    enums() {
        return {
            ProductStatus: Object.values(ProductStatus),
            ProductCondition: Object.values(ProductCondition),
            WeightUnit: Object.values(WeightUnit),
            LengthUnit: Object.values(LengthUnit),
        };
    }

}