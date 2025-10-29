// src/products/dto/update-product-with-variants.dto.ts
import { UpdateProductDto } from './update-product.dto';

export class VariantUpsertDto {
  id?: string;                    // present => update; absent => create
  sku!: string;
  sizeId?: string | null;
  sizeText?: string | null;
  barcode?: string | null;
  status?: string | null;
  condition?: string | null;
  isDraft?: boolean | null;
  publishedAt?: Date | string | null;

  // numeric fields may be Decimal-like; keep as any to avoid TS friction
  weight?: any; 
  weightUnit?: string | null;
  length?: any;
  width?: any;
  height?: any;
  dimensionUnit?: string | null;

  attributes?: any;

  retailPrice?: any;
  retailCurrency?: string | null;
  originalPrice?: any;
  originalCurrency?: string | null;
}

export class UpdateProductWithVariantsDto extends UpdateProductDto {
  variants!: VariantUpsertDto[];   // full set you want persisted after save
  removeMissing?: boolean;         // if true, variants not in payload will be deleted
}
