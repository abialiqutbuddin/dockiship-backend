// src/rbac/dto/update-role.dto.ts
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}