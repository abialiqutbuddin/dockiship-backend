import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class ListProviderQueryDto {
  @IsOptional() @IsString()
  q?: string;
}

export class ListChannelQueryDto {
  @IsString()
  provider!: string;

  @IsOptional() @IsString()
  q?: string;
}

export class CreateChannelDto {
  @IsString() @IsNotEmpty()
  provider!: string;

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
  provider!: string;

  @IsString() @IsNotEmpty()
  name!: string; // channel name

  @IsString() @IsNotEmpty()
  externalSku!: string;

  @IsInt() @Min(0)
  units!: number;
}

export class CreateListingForVariantDto extends CreateListingForProductDto {
  // same fields + which variant to attach
  @IsString() @IsNotEmpty()
  variantId!: string;
}