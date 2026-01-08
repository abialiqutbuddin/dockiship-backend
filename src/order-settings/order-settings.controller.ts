import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { OrderSettingsService } from './order-settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RbacGuard } from '../common/guards/rbac.guard';

@Controller('order-settings')
@UseGuards(TenantGuard, JwtAuthGuard, RbacGuard)
export class OrderSettingsController {
    constructor(private readonly service: OrderSettingsService) { }

    // =====================
    // Courier Mediums
    // =====================
    @Get('courier-mediums')
    @Roles('Admin', 'Owner')
    @Permissions('order_settings.read', 'order_settings.manage')
    async getCourierMediums(
        @TenantId() tenantId: string,
        @Query('search') search?: string,
        @Query('status') status?: 'active' | 'inactive' | '',
    ) {
        return this.service.getCourierMediums(tenantId, { search, status });
    }

    @Post('courier-mediums')
    @Roles('Admin', 'Owner')
    @Permissions('order_settings.manage')
    async createCourierMedium(
        @TenantId() tenantId: string,
        @Body() body: { fullName: string; shortName: string },
    ) {
        return this.service.createCourierMedium(tenantId, body);
    }

    @Patch('courier-mediums/:id')
    @Roles('Admin', 'Owner')
    @Permissions('order_settings.manage')
    async updateCourierMedium(
        @TenantId() tenantId: string,
        @Param('id') id: string,
        @Body() body: { fullName?: string; shortName?: string; isActive?: boolean },
    ) {
        return this.service.updateCourierMedium(tenantId, id, body);
    }

    @Delete('courier-mediums/:id')
    @Roles('Admin', 'Owner')
    @Permissions('order_settings.manage')
    async deleteCourierMedium(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.service.deleteCourierMedium(tenantId, id);
    }

    // =====================
    // Remark Types
    // =====================
    @Get('remark-types')
    @Roles('Admin', 'Owner')
    @Permissions('order_settings.read', 'order_settings.manage')
    async getRemarkTypes(
        @TenantId() tenantId: string,
        @Query('search') search?: string,
        @Query('status') status?: 'active' | 'inactive' | '',
    ) {
        return this.service.getRemarkTypes(tenantId, { search, status });
    }

    @Post('remark-types')
    @Roles('Admin', 'Owner')
    @Permissions('order_settings.manage')
    async createRemarkType(
        @TenantId() tenantId: string,
        @Body() body: { name: string; description?: string },
    ) {
        return this.service.createRemarkType(tenantId, body);
    }

    @Patch('remark-types/:id')
    @Roles('Admin', 'Owner')
    @Permissions('order_settings.manage')
    async updateRemarkType(
        @TenantId() tenantId: string,
        @Param('id') id: string,
        @Body() body: { name?: string; description?: string; isActive?: boolean },
    ) {
        return this.service.updateRemarkType(tenantId, id, body);
    }

    @Delete('remark-types/:id')
    @Roles('Admin', 'Owner')
    @Permissions('order_settings.manage')
    async deleteRemarkType(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.service.deleteRemarkType(tenantId, id);
    }
}
