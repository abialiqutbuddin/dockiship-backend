import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterOwnerDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  fullName?: string;
}