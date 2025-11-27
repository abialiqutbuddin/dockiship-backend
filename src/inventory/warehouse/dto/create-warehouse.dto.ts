import {
  IsISO31661Alpha2,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateWarehouseDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsISO31661Alpha2()
  @IsNotEmpty()
  country!: string;

  @IsOptional()
  @IsString()
  address1?: string;

  @IsOptional()
  @IsString()
  address2?: string;

  @IsNotEmpty()
  @IsString()
  city!: string;

  @IsNotEmpty()
  @IsString()
  state!: string;

  @IsOptional()
  @IsString()
  zipCode?: string;
}
