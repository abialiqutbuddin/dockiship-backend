import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class ListProductNameQueryDto {
  @IsOptional() @IsString()
  q?: string;
}

export class ListChannelQueryDto {
  @IsOptional() @IsString()
  q?: string;
}

export class CreateChannelDto {
  @IsString() @IsNotEmpty()
  marketplace!: string;

  @IsOptional() @IsString()
  accountId?: string;

  @IsOptional() @IsString()
  storeUrl?: string;
}

export class CreateListingForProductDto {
  // create a listing for the parent product
  @IsString() @IsNotEmpty()
  productName!: string; // renamed from provider

  @IsString() @IsNotEmpty()
  marketplace!: string; // channel name

  @IsOptional() @IsString()
  externalSku?: string;

  @IsInt() @Min(0)
  units!: number;
}

export class CreateListingForVariantDto extends CreateListingForProductDto {
  // same fields + which variant to attach
  @IsString() @IsNotEmpty()
  variantId!: string;
}
