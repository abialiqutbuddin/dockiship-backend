import { Module } from '@nestjs/common';
import { OrderSettingsController } from './order-settings.controller';
import { OrderSettingsService } from './order-settings.service';

@Module({
    controllers: [OrderSettingsController],
    providers: [OrderSettingsService],
})
export class OrderSettingsModule { }
