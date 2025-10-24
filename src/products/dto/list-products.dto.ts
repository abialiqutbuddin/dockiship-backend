// ---------------------------------------------
// src/products/dto/list-products.dto.ts
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ProductStatus } from '@prisma/client';

export class ListProductsQueryDto {
  @IsOptional() @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @IsInt() @Min(1) @Max(200) perPage?: number = 20;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
}
