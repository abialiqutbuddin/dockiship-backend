// src/users/dto/set-roles.dto.ts
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class SetRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roleIds!: string[];
}