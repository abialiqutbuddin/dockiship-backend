import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  // ISO-4217: 3 letters
  @IsOptional()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code (e.g., USD, PKR)' })
  currency?: string;

  // IANA TZ database name (basic shape check; backend stores as string)
  @IsOptional()
  @Matches(/^[A-Za-z_]+(?:\/[A-Za-z_]+)*$/, { message: 'timezone must be a valid IANA name like Asia/Karachi' })
  timezone?: string;
}