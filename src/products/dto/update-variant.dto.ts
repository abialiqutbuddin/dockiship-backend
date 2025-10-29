// ---------------------------------------------
// src/products/dto/update-variant.dto.ts
import { PartialType as P } from '@nestjs/mapped-types';
import { CreateVariantDto } from './create-products.dto';
export class UpdateVariantDto extends P(CreateVariantDto) {}