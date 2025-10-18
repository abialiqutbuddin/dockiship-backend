import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;     // keep generic; add @IsPhoneNumber('ZZ') if you’ve enabled it

  @IsOptional()
  @IsString()
  country?: string;   // e.g., "PK", "US" — validate to ISO-3166-1 alpha-2 if you like

  @IsOptional()
  @IsBoolean()
  isActive?: boolean; // global user flag; allow only if you want admins to toggle it
}