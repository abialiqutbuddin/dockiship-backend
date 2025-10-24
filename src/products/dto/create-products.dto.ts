// ---------------------------------------------
// src/products/dto/create-product.dto.ts
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { LengthUnit, ProductCondition, ProductStatus, WeightUnit } from '@prisma/client';

export class CreateVariantDto {
  @IsString() sku!: string;
  @IsOptional() @IsUUID() sizeId?: string;
  @IsOptional() @IsString() sizeText?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsEnum(ProductCondition) condition?: ProductCondition;
  @IsOptional() @IsBoolean() isDraft?: boolean;
  @IsOptional() publishedAt?: Date | null;

  @IsOptional() @IsNumber() weight?: number;
  @IsOptional() @IsEnum(WeightUnit) weightUnit?: WeightUnit;
  @IsOptional() @IsNumber() length?: number;
  @IsOptional() @IsNumber() width?: number;
  @IsOptional() @IsNumber() height?: number;
  @IsOptional() @IsEnum(LengthUnit) dimensionUnit?: LengthUnit;
  @IsOptional() attributes?: Record<string, any>;
}

export class CreateProductDto {
  @IsString() sku!: string;
  @IsString() @MaxLength(255) name!: string;
  @IsOptional() @IsString() brand?: string | null;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() originCountry?: string | null;
  @IsOptional() @IsEnum(ProductCondition) condition?: ProductCondition;

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

  // relations
  @IsOptional() @IsUUID() primarySupplierId?: string | null;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateVariantDto)
  variants?: CreateVariantDto[];
}
