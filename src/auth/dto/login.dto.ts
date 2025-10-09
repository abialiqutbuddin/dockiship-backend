// src/auth/dto/login.dto.ts
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class OwnerLoginDto {
  @IsEmail()
  email!: string;
  @IsString() @MinLength(8)
  password!: string;

  // Optional: allow owner to specify which tenant to enter (if owning multiple)
  @IsOptional() @IsString() tenantId?: string;
}

export class MemberLoginDto {
  @IsEmail()
  email!: string;

  @IsString() @MinLength(8)
  password!: string;

  @IsOptional() @IsString()
  tenantId?: string; // now optional; discovery flow if omitted
}