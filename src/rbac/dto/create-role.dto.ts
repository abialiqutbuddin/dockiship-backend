// src/rbac/dto/create-role.dto.ts
import { IsArray, IsOptional, IsString, MaxLength, ArrayNotEmpty, ArrayUnique } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  // optional: set permissions at creation time
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  permissionNames?: string[];
}