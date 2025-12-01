import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddPaymentDto {
    @IsNumber()
    @Min(0)
    amount!: number;

    @IsOptional()
    @IsDateString()
    date?: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsString()
    method?: string;

    @IsOptional()
    @IsString()
    reference?: string;
}
