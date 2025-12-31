import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LocationService } from './location.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('location')
@UseGuards(JwtAuthGuard)
export class LocationController {
    constructor(private readonly service: LocationService) { }

    @Get('postal-code')
    async lookup(
        @Query('code') code: string,
        @Query('country') country?: string,
    ) {
        return this.service.lookup(code, country);
    }
}
