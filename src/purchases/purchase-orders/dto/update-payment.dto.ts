import { IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePaymentDto {
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    amountPaid!: number;
}
