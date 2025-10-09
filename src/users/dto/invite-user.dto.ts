// src/users/dto/invite-user.dto.ts
import { IsEmail, IsOptional, IsString, IsArray } from 'class-validator';

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsArray()
  roleIds?: string[];
}