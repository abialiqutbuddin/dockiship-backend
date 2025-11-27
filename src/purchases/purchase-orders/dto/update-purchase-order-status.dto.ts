import { IsEnum } from 'class-validator';
import { POStatus } from '@prisma/client';

export class UpdatePurchaseOrderStatusDto {
  @IsEnum(POStatus)
  status!: POStatus;
}

