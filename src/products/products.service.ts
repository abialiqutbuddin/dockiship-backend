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
    async createProduct(tenantId: string, dto: CreateProductDto) {
        const exists = await this.prisma.product.findFirst({ where: { tenantId, sku: dto.sku } });
        if (exists) throw new BadRequestException('SKU already exists for tenant');

        return this.prisma.product.create({
            data: {
                tenantId,
                sku: dto.sku,
                name: dto.name,
                brand: dto.brand ?? null,
                status: dto.status,
                originCountry: dto.originCountry ?? null,
                condition: dto.condition,
                weight: dto.weight as any,
                weightUnit: dto.weightUnit,
                length: dto.length as any,
                width: dto.width as any,
                height: dto.height as any,
                dimensionUnit: dto.dimensionUnit,
                isDraft: dto.isDraft ?? false,
                publishedAt: dto.publishedAt ?? null,
                retailPrice: dto.retailPrice as any,
                retailCurrency: dto.retailCurrency ?? null,
                originalPrice: dto.originalPrice as any,
                originalCurrency: dto.originalCurrency ?? null,
                primarySupplierId: dto.primarySupplierId ?? null,
                ProductVariant: dto.variants && dto.variants.length
                    ? {
                        create: dto.variants.map((v) => ({
                            sku: v.sku,
                            sizeId: v.sizeId,
                            sizeText: v.sizeText,
                            barcode: v.barcode,
                            status: v.status,
                            condition: v.condition,
                            isDraft: v.isDraft ?? false,
                            publishedAt: v.publishedAt ?? null,
                            weight: v.weight as any,
                            weightUnit: v.weightUnit,
                            length: v.length as any,
                            width: v.width as any,
                            height: v.height as any,
                            dimensionUnit: v.dimensionUnit,
                            attributes: v.attributes as any,
                        })),
                    }
                    : undefined,
            },
            include: { ProductVariant: true },
        });
    }

    // LIST PRODUCTS (paginated)
    async listProducts(tenantId: string, q: ListProductsQueryDto) {
        const { page = 1, perPage = 20, search, status } = q;
        const where: any = { tenantId };
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { brand: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [items, total] = await this.prisma.$transaction([
            this.prisma.product.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * perPage,
                take: perPage,
                include: {
                    ProductVariant: { select: { id: true, sku: true, status: true } },
                    primarySupplier: { select: { id: true, companyName: true } },
                },
            }),
            this.prisma.product.count({ where }),
        ]);

        return {
            page,
            perPage,
            total,
            totalPages: Math.ceil(total / perPage),
            items,
        };
    }

    // GET ONE PRODUCT (with relations)
    async getProduct(tenantId: string, productId: string) {
        const product = await this.prisma.product.findFirst({
            where: { id: productId, tenantId },
            include: {
                ProductVariant: true,
                barcodes: true,
                images: true,
                tagLinks: { include: { tag: true } },
                supplierLinks: { include: { supplier: true } },
                primarySupplier: true,
            },
        });
        if (!product) throw new NotFoundException('Product not found');
        return product;
    }

    // UPDATE PRODUCT
    async updateProduct(tenantId: string, productId: string, dto: UpdateProductDto) {
        const found = await this.prisma.product.findFirst({ where: { id: productId, tenantId } });
        if (!found) throw new NotFoundException('Product not found');

        return this.prisma.product.update({
            where: { id: productId },
            data: {
                sku: dto.sku,
                name: dto.name,
                brand: dto.brand,
                status: dto.status,
                originCountry: dto.originCountry,
                condition: dto.condition,
                weight: (dto as any).weight,
                weightUnit: dto.weightUnit,
                length: (dto as any).length,
                width: (dto as any).width,
                height: (dto as any).height,
                dimensionUnit: dto.dimensionUnit,
                isDraft: dto.isDraft,
                publishedAt: dto.publishedAt,
                retailPrice: (dto as any).retailPrice,
                retailCurrency: dto.retailCurrency,
                originalPrice: (dto as any).originalPrice,
                originalCurrency: dto.originalCurrency,
                primarySupplierId: dto.primarySupplierId,
            },
            include: { ProductVariant: true },
        });
    }

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
            },
        });
    }

    async updateVariant(tenantId: string, productId: string, variantId: string, dto: UpdateVariantDto) {
        const variant = await this.prisma.productVariant.findFirst({
            where: { id: variantId, productId, product: { tenantId } },
        });
        if (!variant) throw new NotFoundException('Variant not found');

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
        };
    }

}