// src/products/dto/update-product-with-variants.dto.ts
import { Type } from 'class-transformer';
import { ValidateNested, IsOptional, IsArray } from 'class-validator';
import { UpdateProductDto } from './update-product.dto';
import { CreateVariantDto } from './create-products.dto';

// Make each element: "everything a CreateVariantDto needs" + optional id
export class VariantUpsertDto implements CreateVariantDto {
    // --- Add this ---
    @IsOptional()
    id?: string;

    // ---- Keep the exact shape of CreateVariantDto here (no `null` types) ----
    // Example (adjust to match your actual CreateVariantDto):
    sku!: string;
    @IsOptional() sizeId?: string;            // no `null`
    @IsOptional() sizeText?: string;          // no `null`
    @IsOptional() colorText?: string;
    @IsOptional() barcode?: string;
    @IsOptional() Status?: string;
    @IsOptional() Condition?: string;
    @IsOptional() isDraft?: boolean;
    @IsOptional() PublishedAt?: string | Date; // not `null`

    @IsOptional() weight?: any;
    @IsOptional() WeightUnit?: string;
    @IsOptional() length?: any;
    @IsOptional() width?: any;
    @IsOptional() height?: any;
    @IsOptional() DimensionUnit?: string;
    @IsOptional() attributes?: any;

    @IsOptional() retailPrice?: any;
    @IsOptional() retailCurrency?: string;
    @IsOptional() originalPrice?: any;
    @IsOptional() originalCurrency?: string;
    @IsOptional() stockOnHand?: number;
}

// Extend the parent DTO, but make `variants` strictly compatible with its base type
export class UpdateProductWithVariantsDto extends UpdateProductDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => VariantUpsertDto)
    variants!: (CreateVariantDto & { id?: string })[]; // subtype of CreateVariantDto

    @IsOptional()
    removeMissing?: boolean;
}
