// src/users/dto/create-member.dto.ts
import { IsEmail, IsOptional, IsString, MinLength, IsArray } from 'class-validator';

export class CreateMemberDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsArray()
  roleIds?: string[];
}
