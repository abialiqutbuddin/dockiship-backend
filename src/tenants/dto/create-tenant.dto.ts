import { IsOptional, IsString } from 'class-validator';

export class CreateTenantDto {
  @IsOptional()
  @IsString()
  tenantName?: string;

  @IsOptional()
  @IsString()
  description?: string;
}