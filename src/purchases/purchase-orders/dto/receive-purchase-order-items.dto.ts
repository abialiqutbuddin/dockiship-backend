import { IsArray, IsInt, IsNotEmpty, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ReceiveItemDto {
    @IsString()
    @IsNotEmpty()
    itemId!: string;

    @IsInt()
    @Min(1)
    receivedQty!: number;
}

export class ReceivePurchaseOrderItemsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ReceiveItemDto)
    items!: ReceiveItemDto[];
}
