
// src/rbac/dto/update-role-and-perms.dto.ts
import { IsArray, ArrayNotEmpty, IsString, ArrayUnique, IsOptional, MaxLength } from 'class-validator';

export class UpdateRoleAndPermissionsDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsArray()
  //@ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  permissionNames!: string[];
}