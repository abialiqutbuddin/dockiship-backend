import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class ListProviderQueryDto {
  @IsOptional() @IsString()
  q?: string;
}

export class ListChannelQueryDto {
  @IsString()
  productName!: string; // renamed from provider

  @IsOptional() @IsString()
  q?: string;
}

export class CreateChannelDto {
  @IsString() @IsNotEmpty()
  productName!: string; // renamed from provider

  @IsString() @IsNotEmpty()
  name!: string;

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
  name!: string; // channel name

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
