import { IsEnum, IsOptional, IsString } from 'class-validator';
import { POStatus } from '@prisma/client';

export class UpdatePurchaseOrderStatusDto {
  @IsEnum(POStatus)
  status!: POStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

