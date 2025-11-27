// ---------------------------------------------
// src/products/products.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateProductDto, CreateVariantDto } from './dto/create-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { ListProductsQueryDto } from './dto/list-products.dto';
import { ProductStatus, ProductCondition, WeightUnit, LengthUnit, PackagingType } from '@prisma/client';
import { UpdateProductWithVariantsDto } from './dto/update-product-with-variants.dto';
import { join } from 'path';
import { promises as fs } from 'fs';

@Injectable()
export class ProductsService {
    constructor(private readonly prisma: PrismaService) { }

    // helpers
    private ensureTenantMatch(tenantIdFromReq: string, tenantIdFromEntity?: string) {
        if (tenantIdFromEntity && tenantIdFromEntity !== tenantIdFromReq) {
            throw new BadRequestException('Tenant mismatch');
        }
    }

    private resolvePackaging(type?: PackagingType | null, quantity?: number | null) {
        if (!type) {
            return { packagingType: null, packagingQuantity: null };
        }
        if (type === PackagingType.PAIR) {
            return { packagingType: type, packagingQuantity: 2 };
        }
        const numeric = quantity != null ? Number(quantity) : Number.NaN;
        if (!Number.isFinite(numeric) || numeric < 1) {
            throw new BadRequestException(`Packaging quantity must be provided and >= 1 when packaging type is ${type}.`);
        }
        return { packagingType: type, packagingQuantity: Math.trunc(numeric) };
    }

    // CREATE PRODUCT (with optional variants)
    // CREATE PRODUCT (with variant logic)
    async createProduct(tenantId: string, dto: CreateProductDto) {
        const { variants, ...productData } = dto;

        if ((dto as any).sku) {
            const exists = await this.prisma.product.findFirst({ where: { tenantId, sku: (dto as any).sku } });
            if (exists) throw new BadRequestException('Parent SKU already exists for tenant');
        }

        // Auto-generate SKU using initials + unique 8-digit number
        const genInitials = (name?: string) => {
            const s = (name || '').trim();
            if (!s) return 'PRD';
            return s.split(/\s+/).map(w => (w[0] || '').toUpperCase()).join('') || 'PRD';
        };
        const initials = genInitials(productData.name);
        const makeDigits = () => String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
        let sku = ((dto as any).sku && String((dto as any).sku).trim()) || `${initials}-${makeDigits()}`;
        // ensure unique per tenant if we generated it here
        if (!((dto as any).sku)) {
            for (let i = 0; i < 5; i++) {
                const exists = await this.prisma.product.findFirst({ where: { tenantId, sku } });
                if (!exists) break;
                sku = `${initials}-${makeDigits()}`;
            }
        }

        return this.prisma.product.create({
            data: {
                tenantId,
                sku,
                name: productData.name,
                brand: productData.brand ?? null,
                status: productData.status,
                originCountry: productData.originCountry ?? null,
                isDraft: productData.isDraft ?? false,
                publishedAt: productData.publishedAt ?? null,
                // initial purchasing snapshot if provided
                lastPurchasePrice: (productData as any).lastPurchasePrice ?? null,
                lastPurchaseCurr: (productData as any).lastPurchaseCurr ?? null,
                // REMOVED: retailPrice, weight, condition, etc. from here

                ProductVariant: {
                    create: (variants && variants.length > 0)
                        ?   // CASE 1: Variants are provided (Variant Product)
                        variants.map((v) => {
                            const packaging = this.resolvePackaging(
                                (v as any).packagingType ?? null,
                                (v as any).packagingQuantity ?? null,
                            );
                            return {
                                sku: v.sku,
                                sizeId: v.sizeId,
                                sizeText: v.sizeText,
                                colorText: (v as any).colorText,
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
                                lastPurchasePrice: (v as any).lastPurchasePrice as any,
                                lastPurchaseCurr: (v as any).lastPurchaseCurr,
                                packagingType: packaging.packagingType,
                                packagingQuantity: packaging.packagingQuantity,
                                // Stock fields default to 0
                            };
                        })
                        :   // CASE 2: No variants provided (Simple Product)
                        // Create one default variant using the parent SKU and data
                        (() => {
                            const packaging = this.resolvePackaging(
                                (productData as any).packagingType ?? null,
                                (productData as any).packagingQuantity ?? null,
                            );
                            return [{
                                sku, // Use parent SKU for the single variant
                                status: productData.status,
                                condition: productData.condition,
                                isDraft: productData.isDraft,
                                publishedAt: productData.publishedAt,
                                // Use parent-level data
                                sizeText: (productData as any).sizeText,
                                colorText: (productData as any).colorText,
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
                                lastPurchasePrice: (productData as any).lastPurchasePrice as any,
                                lastPurchaseCurr: (productData as any).lastPurchaseCurr,
                                packagingType: packaging.packagingType,
                                packagingQuantity: packaging.packagingQuantity,
                                // Stock fields default to 0
                            }];
                        })(),
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
        const { page = 1, perPage = 25, search, status, supplierId } = q;
        const where: any = { tenantId };
        if (status) where.status = status;
        if (supplierId) {
            where.supplierLinks = { some: { supplierId } };
        }
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { sku: { contains: search } }, // Searches parent SKU
                { brand: { contains: search } },
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
                            // Added to consistently determine simple vs variant (matches getProduct logic)
                            sizeId: true,
                            sizeText: true,
                            colorText: true,
                            attributes: true,
                            packagingType: true,
                            packagingQuantity: true,
                        },
                    },
                    images: { select: { id: true, url: true } },
                },
            }),
            this.prisma.product.count({ where }),
        ]);

        // ******* THIS IS THE NEW, IMPORTANT PART *******
        // We must transform the data for the admin table
        const fmtMoney = (val: any) => {
            if (val === null || val === undefined) return null;
            const num = Number((val as any)?.toNumber ? (val as any).toNumber() : val);
            if (!Number.isFinite(num)) return null;
            return `$${num.toFixed(2)}`;
        };

        const items = products.map((product) => {
            const { ProductVariant, ...parentProduct } = product;
            const variantCount = ProductVariant.length;

            let displayType = 'Simple';
            let displayPrice = 'N/A';
            let displayStock = 'N/A';

            if (variantCount === 1) {
                const v: any = ProductVariant[0];
                // Consider it simple when single variant matches parent SKU and has no explicit variant signals
                const hasVariantSignals = !!v.sizeId || (v.attributes && Object.keys(v.attributes || {}).length > 0);
                const looksSimple = v.sku === (parentProduct as any).sku && !hasVariantSignals;

                displayType = looksSimple ? 'Simple' : 'Variant (1)';
                const money = fmtMoney(v?.retailPrice);
                displayPrice = money ?? 'N/A';
                displayStock = `${v?.stockOnHand || 0} in stock`;

            } else if (variantCount > 1) {
                // VARIANT PRODUCT
                displayType = `Variant (${variantCount})`;

                // Calculate price range
                const nums = ProductVariant
                    .map((vv: any) => (vv?.retailPrice != null ? Number(vv.retailPrice) : null))
                    .filter((n: any) => Number.isFinite(n)) as number[];

                if (nums.length > 0) {
                    const lo = Math.min(...nums);
                    const hi = Math.max(...nums);
                    displayPrice = lo === hi ? `$${lo.toFixed(2)}` : `$${lo.toFixed(2)} - $${hi.toFixed(2)}`;
                }

                // Calculate total stock
                const totalStock = ProductVariant
                    .map((vv: any) => vv?.stockOnHand || 0)
                    .reduce((sum: number, current: number) => sum + current, 0);

                displayStock = `${totalStock} across ${variantCount} variants`;
            }

            // Return the transformed product object for the API response
            return {
                ...parentProduct,
                type: displayType,     // e.g., "Simple" or "Variant (n)"
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
                ProductVariant: { include: { size: true } },
                barcodes: true,
                images: true,
                tagLinks: { include: { tag: true } },
                supplierLinks: { include: { supplier: true } },
            },
        });

        if (!product) throw new NotFoundException('Product not found');

        const variantCount = product._count?.ProductVariant ?? product.ProductVariant.length;
        let kind: 'simple' | 'variant' = 'simple';

        if (variantCount > 1) {
            kind = 'variant';
        } else if (variantCount === 1) {
            const v = product.ProductVariant[0];
            // Treat single-variant products as "simple" even if size/color text is present.
            // Only explicit sizeId or custom attributes should mark it as a real variant.
            const hasVariantSignals =
                !!v.sizeId ||
                (v.attributes && Object.keys(v.attributes as any).length > 0);
            const looksSimple = v.sku === product.sku && !hasVariantSignals;
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
                sizeText,
                colorText,
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
                packagingType,
                packagingQuantity,
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
                sizeText,
                colorText,
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
                packagingType,
                packagingQuantity,
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
        const found = await this.prisma.product.findFirst({ where: { id: productId, tenantId }, include: { ProductVariant: true } });
        if (!found) throw new NotFoundException('Product not found');

        // Enforce unique parent SKU if provided
        if ((dto as any).sku && (dto as any).sku !== found.sku) {
            const clash = await this.prisma.product.findFirst({ where: { tenantId, sku: (dto as any).sku, NOT: { id: productId } } });
            if (clash) throw new BadRequestException('Parent SKU already exists for tenant');
        }

        // Build parent update data
        const parentData: any = {
            sku: (dto as any).sku ?? undefined,
            name: dto.name,
            brand: dto.brand,
            status: dto.status,
            originCountry: dto.originCountry,
            isDraft: dto.isDraft,
            publishedAt: dto.publishedAt,
            lastPurchasePrice: (dto as any).lastPurchasePrice ?? undefined,
            lastPurchaseCurr: (dto as any).lastPurchaseCurr ?? undefined,
        };

        // If simple product (single variant acting as parent) and sku provided, sync the variant sku too
        const variantCount = found.ProductVariant?.length ?? 0;
        const isSimple = variantCount === 1;
        const onlyVariant = isSimple ? found.ProductVariant[0] : null;
        const onlyVariantId = isSimple ? found.ProductVariant[0].id : null;

        await this.prisma.$transaction(async (tx) => {
            await tx.product.update({ where: { id: productId }, data: parentData });
            if (isSimple && onlyVariantId) {
                const update: any = {};
                if ((dto as any).sku) update.sku = (dto as any).sku;
                if ((dto as any).sizeText !== undefined) update.sizeText = (dto as any).sizeText;
                if ((dto as any).colorText !== undefined) update.colorText = (dto as any).colorText;
                if ((dto as any).packagingType !== undefined || (dto as any).packagingQuantity !== undefined) {
                    const packaging = this.resolvePackaging(
                        ((dto as any).packagingType !== undefined ? (dto as any).packagingType : onlyVariant?.packagingType) ?? null,
                        (dto as any).packagingQuantity !== undefined
                            ? (dto as any).packagingQuantity
                            : ((dto as any).packagingType === undefined ? onlyVariant?.packagingQuantity : undefined) ?? null,
                    );
                    update.packagingType = packaging.packagingType;
                    update.packagingQuantity = packaging.packagingQuantity;
                }
                if ((dto as any).retailPrice !== undefined) {
                    update.retailPrice = (dto as any).retailPrice;
                    if ((dto as any).retailCurrency !== undefined) update.retailCurrency = (dto as any).retailCurrency;
                }
                if ((dto as any).originalPrice !== undefined) {
                    update.originalPrice = (dto as any).originalPrice;
                    if ((dto as any).originalCurrency !== undefined) update.originalCurrency = (dto as any).originalCurrency;
                }
                if ((dto as any).lastPurchasePrice !== undefined) {
                    update.lastPurchasePrice = (dto as any).lastPurchasePrice;
                    if ((dto as any).lastPurchaseCurr !== undefined) update.lastPurchaseCurr = (dto as any).lastPurchaseCurr;
                }
                if (Object.keys(update).length) {
                    await tx.productVariant.update({ where: { id: onlyVariantId }, data: update });
                }
            }
        });

        return this.prisma.product.findFirst({
            where: { id: productId, tenantId },
            include: { ProductVariant: true },
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
        const packaging = this.resolvePackaging(dto.packagingType ?? null, (dto as any).packagingQuantity ?? null);

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
                lastPurchasePrice: (dto as any).lastPurchasePrice as any,
                lastPurchaseCurr: (dto as any).lastPurchaseCurr,
                packagingType: packaging.packagingType,
                packagingQuantity: packaging.packagingQuantity,
            },
        });
    }

    async updateVariant(tenantId: string, productId: string, variantId: string, dto: UpdateVariantDto) {
        const variant = await this.prisma.productVariant.findFirst({
            where: { id: variantId, productId, product: { tenantId } },
        });
        if (!variant) throw new NotFoundException('Variant not found');
        const packagingTouched =
            dto.packagingType !== undefined ||
            (dto as any).packagingQuantity !== undefined;
        const packaging = packagingTouched
            ? this.resolvePackaging(
                (dto.packagingType !== undefined ? dto.packagingType : variant.packagingType) ?? null,
                (dto as any).packagingQuantity !== undefined
                    ? (dto as any).packagingQuantity
                    : (dto.packagingType === undefined ? variant.packagingQuantity : undefined) ?? null,
            )
            : null;

        return this.prisma.productVariant.update({
            where: { id: variantId },
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
                attributes: dto.attributes as any,
                // Add price fields
                retailPrice: (dto as any).retailPrice,
                retailCurrency: dto.retailCurrency,
                originalPrice: (dto as any).originalPrice,
                originalCurrency: dto.originalCurrency,
                lastPurchasePrice: (dto as any).lastPurchasePrice,
                lastPurchaseCurr: (dto as any).lastPurchaseCurr,
                ...(packaging ? {
                    packagingType: packaging.packagingType,
                    packagingQuantity: packaging.packagingQuantity,
                } : {}),
            },
        });
    }

    // src/products/products.service.ts (add this method)

    async updateProductWithVariants(
        tenantId: string,
        productId: string,
        dto: UpdateProductWithVariantsDto
    ) {
        // 1) Guard product/tenant
        const product = await this.prisma.product.findFirst({
            where: { id: productId, tenantId },
            select: { id: true },
        });
        if (!product) throw new NotFoundException('Product not found');

        const { variants = [], removeMissing = false, ...parent } = dto;

        // Enforce unique parent SKU if provided in parent
        if ((parent as any).sku) {
            const clash = await this.prisma.product.findFirst({ where: { tenantId, sku: (parent as any).sku, NOT: { id: productId } } });
            if (clash) throw new BadRequestException('Parent SKU already exists for tenant');
        }

        // 2) Load current variants
        const existing = await this.prisma.productVariant.findMany({
            where: { productId },
            select: { id: true, sku: true },
        });
        const existingById = new Map(existing.map(v => [v.id, v]));
        const existingSkus = new Map(existing.map(v => [v.sku, v.id]));

        // 3) Basic validations
        // 3a) no duplicate SKUs within payload
        const payloadSkuSet = new Set<string>();
        for (const v of variants) {
            if (!v.sku) throw new BadRequestException('Variant SKU is required');
            const key = v.sku.trim();
            if (payloadSkuSet.has(key)) {
                throw new BadRequestException(`Duplicate SKU in payload: ${key}`);
            }
            payloadSkuSet.add(key);
        }

        // 3b) enforce SKU uniqueness across product (exclude the same-id record on updates)
        for (const v of variants) {
            const foundId = existingSkus.get(v.sku);
            if (foundId && (!v.id || v.id !== foundId)) {
                throw new BadRequestException(`Variant SKU already exists: ${v.sku}`);
            }
        }

        // 3c) verify all incoming IDs (when provided) belong to this product
        for (const v of variants) {
            if (v.id && !existingById.has(v.id)) {
                throw new NotFoundException(`Variant not found: ${v.id}`);
            }
        }

        // 4) Build transactional ops
        const ops: any[] = [];

        // 4a) Update parent product (keep parent-only fields, don’t touch variant-only fields)
        ops.push(
            this.prisma.product.update({
                where: { id: productId },
                data: {
                    sku: (parent as any).sku ?? undefined,
                    name: parent.name,
                    brand: parent.brand,
                    status: parent.status,
                    originCountry: parent.originCountry,
                    isDraft: parent.isDraft,
                    publishedAt: parent.publishedAt,
                },
            })
        );

        // 4b) Upsert variants (create if no id, update if id)
        for (const v of variants) {
            const packagingTouched =
                !v.id ||
                (v as any).packagingType !== undefined ||
                (v as any).packagingQuantity !== undefined;
            const packaging = packagingTouched
                ? this.resolvePackaging(
                    (v as any).packagingType ?? null,
                    (v as any).packagingQuantity ?? null,
                )
                : null;
            const data = {
                productId,
                sku: v.sku,
                sizeId: v.sizeId,
                sizeText: v.sizeText,
                colorText: (v as any).colorText,
                barcode: v.barcode,
                status: v.status as any,
                condition: v.condition as any,
                isDraft: v.isDraft ?? false,
                publishedAt: v.publishedAt ? new Date(v.publishedAt as any) : null,
                weight: v.weight as any,
                weightUnit: v.weightUnit as any,
                length: v.length as any,
                width: v.width as any,
                height: v.height as any,
                dimensionUnit: v.dimensionUnit as any,
                attributes: v.attributes as any,
                retailPrice: v.retailPrice as any,
                retailCurrency: v.retailCurrency as any,
                originalPrice: v.originalPrice as any,
                originalCurrency: v.originalCurrency as any,
                lastPurchasePrice: (v as any).lastPurchasePrice as any,
                lastPurchaseCurr: (v as any).lastPurchaseCurr as any,
                ...(packaging ? {
                    packagingType: packaging.packagingType,
                    packagingQuantity: packaging.packagingQuantity,
                } : {}),
            };

            if (v.id) {
                ops.push(
                    this.prisma.productVariant.update({
                        where: { id: v.id },
                        data,
                    })
                );
            } else {
                ops.push(
                    this.prisma.productVariant.create({
                        data,
                    })
                );
            }
        }

        // 4c) Optionally delete variants not present in payload
        if (removeMissing) {
            const incomingIds = new Set(variants.filter(v => v.id).map(v => v.id!));
            const idsToDelete = existing
                .map(v => v.id)
                .filter(id => !incomingIds.has(id)); // remove those not included

            if (idsToDelete.length) {
                ops.push(
                    this.prisma.productVariant.deleteMany({
                        where: { id: { in: idsToDelete } },
                    })
                );
            }
        }

        // 5) Execute atomically
        await this.prisma.$transaction(ops);

        // 6) Return the refreshed product with variants (and your usual includes)
        return this.prisma.product.findFirst({
            where: { id: productId, tenantId },
            include: {
                _count: { select: { ProductVariant: true } },
                ProductVariant: { include: { size: true } },
                barcodes: true,
                images: true,
                tagLinks: { include: { tag: true } },
                supplierLinks: { include: { supplier: true } },
            },
        });
    }


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
            PackagingType: Object.values(PackagingType),
        };
    }

    // IMAGES ----------------------------------------------------
    async addProductImages(tenantId: string, productId: string, urls: string[], alt?: string) {
        if (!urls || urls.length === 0) return [];
        const created = [] as any[];
        for (const url of urls) {
            const img = await this.prisma.productImage.create({
                data: { tenantId, productId, url, alt: alt ?? null },
            });
            created.push(img);
        }
        return created;
    }

    async listProductImages(tenantId: string, productId: string) {
        return this.prisma.productImage.findMany({ where: { tenantId, productId }, orderBy: { id: 'desc' } });
    }

    async removeProductImage(tenantId: string, productId: string, imageId: string) {
        const pic = await this.prisma.productImage.findFirst({ where: { id: imageId, productId, tenantId } });
        if (!pic) throw new NotFoundException('Image not found');
        // Best-effort delete file from disk (url starts with /uploads/...)
        try {
            if (pic.url?.startsWith('/uploads/')) {
                const abs = join(process.cwd(), pic.url);
                await fs.unlink(abs).catch(() => { });
            }
        } catch { }
        await this.prisma.productImage.delete({ where: { id: imageId } });
        return { ok: true };
    }

    async listListingProductNames(tenantId: string, q?: string) {
        // Query distinct productNames from ChannelListing
        const results = await this.prisma.channelListing.findMany({
            where: {
                channel: { tenantId },
                ...(q ? { productName: { contains: q } } : {}),
                productName: { not: null },
            },
            distinct: ['productName'],
            select: { productName: true },
            orderBy: { productName: 'asc' },
        });
        return results.map(r => ({ provider: r.productName })); // Keep 'provider' key for frontend compatibility if needed, or change to productName
    }

    async listMarketplaceChannels(tenantId: string, q?: string) {
        return this.prisma.tenantChannel.findMany({
            where: {
                tenantId,
                ...(q ? { marketplace: { contains: q } } : {}),
            },
            select: { id: true, marketplace: true },
            orderBy: { marketplace: 'asc' },
        });
    }

    async createMarketplaceChannel(tenantId: string, dto: { marketplace: string; accountId?: string; storeUrl?: string }) {
        const marketplace = dto.marketplace.trim();
        if (!marketplace) throw new BadRequestException('marketplace name is required');

        // unique constraint: @@unique([tenantId, provider, marketplace])
        // We use provider=null for new decoupled channels
        try {
            return await this.prisma.tenantChannel.create({
                data: {
                    tenantId,
                    marketplace,
                    provider: null, // Explicitly null
                    accountId: dto.accountId,
                    storeUrl: dto.storeUrl,
                    isActive: true,
                },
                select: { id: true, marketplace: true },
            });
        } catch (e: any) {
            if (e?.code === 'P2002') {
                // already exists → return existing
                const existing = await this.prisma.tenantChannel.findFirst({
                    where: { tenantId, marketplace, provider: null },
                    select: { id: true, marketplace: true },
                });
                if (existing) return existing;

                // Fallback: if it exists with a provider (legacy), return that?
                // But we want to encourage provider=null.
                // If the user typed "Amazon", and we have "Amazon" (provider=null), we return it.
                // If we have "Amazon" (provider="ProdA"), we don't return it here because of `provider: null` check above.
                // But `create` failed on unique constraint?
                // If unique is [tenantId, provider, marketplace], then [T1, null, Amazon] is distinct from [T1, ProdA, Amazon].
                // So it shouldn't fail unless [T1, null, Amazon] exists.
                // So the logic above is correct.
            }
            throw e;
        }
    }

    // --- MARKETPLACES: listings ---

    async listProductListings(tenantId: string, productId: string) {
        // includes both product level and variant-level listings
        // and resolves variant SKU for UI
        const [product, listings, variants] = await Promise.all([
            this.prisma.product.findFirst({ where: { id: productId, tenantId }, select: { id: true } }),
            this.prisma.channelListing.findMany({
                where: { productId },
                include: { channel: true },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.productVariant.findMany({
                where: { productId },
                select: { id: true, sku: true, sizeText: true },
            }),
        ]);
        if (!product) throw new NotFoundException('Product not found');

        const varMap = new Map(variants.map(v => [v.id, v]));
        const variantListings = await this.prisma.channelListing.findMany({
            where: { productVariantId: { in: variants.map(v => v.id) } },
            include: { channel: true },
            orderBy: { createdAt: 'desc' },
        });

        return {
            productListings: listings,
            variantListings: variantListings.map(l => ({
                ...l,
                variantMeta: varMap.get(l.productVariantId!),
            })),
        };
    }

    async addProductListing(tenantId: string, productId: string, data: { productName: string; marketplace: string; externalSku?: string; units: number }) {
        const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId }, select: { id: true } });
        if (!product) throw new NotFoundException('Product not found');

        const channel = await this.createMarketplaceChannel(tenantId, { marketplace: data.marketplace });

        try {
            const externalSku = data.externalSku && data.externalSku.trim() ? data.externalSku.trim() : null;
            return await this.prisma.channelListing.create({
                data: {
                    tenantChannelId: channel.id,
                    productName: data.productName, // Save product name
                    productId,                 // parent product
                    externalSku: externalSku ?? undefined,
                    units: data.units,
                    status: 'active',
                },
            });
        } catch (e: any) {
            if (e?.code === 'P2002') {
                throw new BadRequestException('Listing already exists for this channel/target or externalSku already used');
            }
            throw e;
        }
    }

    async addVariantListing(tenantId: string, productId: string, data: { productName: string; marketplace: string; externalSku?: string; units: number; variantId: string }) {
        const variant = await this.prisma.productVariant.findFirst({
            where: { id: data.variantId, product: { id: productId, tenantId } },
            select: { id: true, sku: true, productId: true },
        });
        if (!variant) throw new NotFoundException('Variant not found');

        const channel = await this.createMarketplaceChannel(tenantId, { marketplace: data.marketplace });

        try {
            const externalSku = data.externalSku && data.externalSku.trim() ? data.externalSku.trim() : variant.sku;
            return await this.prisma.channelListing.create({
                data: {
                    tenantChannelId: channel.id,
                    productName: data.productName, // Save product name
                    productVariantId: variant.id, // variant listing
                    externalSku,
                    units: data.units,
                    status: 'active',
                },
            });
        } catch (e: any) {
            if (e?.code === 'P2002') {
                throw new BadRequestException('Listing already exists for this channel/target or externalSku already used');
            }
            throw e;
        }
    }

    async deleteListing(tenantId: string, productId: string, listingId: string) {
        if (!listingId) throw new BadRequestException('Missing listingId');
        const listing = await this.prisma.channelListing.findFirst({
            where: {
                id: listingId,
                OR: [
                    { productId },
                    { productVariant: { productId } },
                ],
                channel: { tenantId },
            },
            select: { id: true },
        });
        if (!listing) throw new NotFoundException('Marketplace listing not found');

        await this.prisma.channelListing.delete({ where: { id: listingId } });
        return { ok: true };
    }
}
