// ---------------------------------------------
// src/products/dto/create-product.dto.ts
import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { LengthUnit, PackagingType, ProductCondition, ProductStatus, WeightUnit } from '@prisma/client';

export class CreateVariantDto {
  @IsString() sku!: string;
  @IsOptional() @IsUUID() sizeId?: string;
  @IsOptional() @IsString() sizeText?: string;
  @IsOptional() @IsString() colorText?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsEnum(ProductCondition) condition?: ProductCondition;
  @IsOptional() @IsBoolean() isDraft?: boolean;
  @IsOptional() publishedAt?: Date | null;

  @IsOptional() @IsNumber() retailPrice?: number;
  @IsOptional() retailCurrency?: string | null;
  @IsOptional() @IsNumber() originalPrice?: number;
  @IsOptional() originalCurrency?: string | null;

  // purchasing snapshot per variant
  @IsOptional() @IsNumber() lastPurchasePrice?: number;
  @IsOptional() lastPurchaseCurr?: string | null;

  @IsOptional() @IsNumber() weight?: number;
  @IsOptional() @IsEnum(WeightUnit) weightUnit?: WeightUnit;
  @IsOptional() @IsNumber() length?: number;
  @IsOptional() @IsNumber() width?: number;
  @IsOptional() @IsNumber() height?: number;
  @IsOptional() @IsEnum(LengthUnit) dimensionUnit?: LengthUnit;
  @IsOptional() attributes?: Record<string, any>;
  @IsOptional() @IsEnum(PackagingType) packagingType?: PackagingType;
  @IsOptional() @IsInt() @Min(1) packagingQuantity?: number;
  @IsOptional() @IsInt() @Min(0) stockOnHand?: number;
}

export class CreateProductDto {
  @IsString() sku!: string;
  @IsString() @MaxLength(255) name!: string;
  @IsOptional() @IsString() brand?: string | null;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() originCountry?: string | null;
  @IsOptional() @IsString() category?: string | null;
  @IsOptional() @IsEnum(ProductCondition) condition?: ProductCondition;
  // Simple product helpers (applied to default variant when no variants array provided)
  @IsOptional() @IsString() sizeText?: string;
  @IsOptional() @IsString() colorText?: string;
  @IsOptional() @IsString() barcode?: string;

  // physicals
  @IsOptional() @IsNumber() weight?: number;
  @IsOptional() @IsEnum(WeightUnit) weightUnit?: WeightUnit;
  @IsOptional() @IsNumber() length?: number;
  @IsOptional() @IsNumber() width?: number;
  @IsOptional() @IsNumber() height?: number;
  @IsOptional() @IsEnum(LengthUnit) dimensionUnit?: LengthUnit;

  // publish
  @IsOptional() @IsBoolean() isDraft?: boolean;
  @IsOptional() publishedAt?: Date | null;

  // commerce
  @IsOptional() @IsNumber() retailPrice?: number;
  @IsOptional() retailCurrency?: string | null;
  @IsOptional() @IsNumber() originalPrice?: number;
  @IsOptional() originalCurrency?: string | null;

  // purchasing snapshot (at product level)
  @IsOptional() @IsNumber() lastPurchasePrice?: number;
  @IsOptional() lastPurchaseCurr?: string | null;

  // relations: primary supplier removed; use ProductSupplier join links
  @IsOptional() @IsString() @IsUUID() supplierId?: string;

  @IsOptional() @IsEnum(PackagingType) packagingType?: PackagingType;
  @IsOptional() @IsInt() @Min(1) packagingQuantity?: number;
  @IsOptional() @IsInt() @Min(0) stockOnHand?: number;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateVariantDto)
  variants?: CreateVariantDto[];
}
