import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RequestPasswordResetDto {
  @IsEmail()
  email!: string;

  // purely for frontend redirect convenience; not validated on backend
  @IsOptional() @IsString()
  tenantId?: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString() @MinLength(8)
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString() @MinLength(8)
  newPassword!: string;
}