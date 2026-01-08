import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { OrdersService, CreateOrderDto, UpdateOrderDto, OrderFilterDto } from './orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RbacGuard } from '../common/guards/rbac.guard';
import { OrderStatus } from '@prisma/client';

@Controller('orders')
@UseGuards(TenantGuard, JwtAuthGuard, RbacGuard)
export class OrdersController {
    constructor(private readonly service: OrdersService) { }

    @Post()
    create(@Req() req: any, @Body() dto: CreateOrderDto) {
        return this.service.createOrder(req.tenantId, dto);
    }

    @Get()
    findAll(
        @Req() req: any,
        @Query('search') search?: string,
        @Query('status') status?: OrderStatus | 'ALL',
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('mediumId') mediumId?: string,
        @Query('courierId') courierId?: string,
        @Query('page') page?: number,
        @Query('perPage') perPage?: number,
    ) {
        const filters: OrderFilterDto & { page?: number; perPage?: number } = { search, status, startDate, endDate, mediumId, courierId, page, perPage };
        return this.service.getOrders(req.tenantId, filters);
    }

    @Get('meta/counts')
    getCounts(@Req() req: any) {
        return this.service.getCounts(req.tenantId);
    }

    @Patch(':id')
    update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateOrderDto) {
        return this.service.updateOrder(req.tenantId, id, dto);
    }

    @Delete(':id')
    remove(@Req() req: any, @Param('id') id: string) {
        return this.service.deleteOrder(req.tenantId, id);
    }

    // Helpers
    @Get('meta/colors')
    getColors(@Req() req: any) {
        return this.service.getColors(req.tenantId);
    }

    @Post('meta/colors')
    createColor(@Req() req: any, @Body() body: { name: string; code?: string }) {
        return this.service.createColor(req.tenantId, body.name, body.code);
    }

    @Post('meta/sizes')
    createSize(@Req() req: any, @Body() body: { code: string; name?: string }) {
        return this.service.createSize(req.tenantId, body.code, body.name);
    }

    @Post('meta/categories')
    createCategory(@Req() req: any, @Body() body: { name: string }) {
        return this.service.createCategory(req.tenantId, body.name);
    }

    // Attachments
    @Post(':id/attachments')
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: './uploads/orders',
            filename: (req, file, cb) => {
                const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                cb(null, `${randomName}${extname(file.originalname)}`);
            }
        })
    }))
    uploadAttachment(
        @Req() req: any,
        @Param('id') id: string,
        @UploadedFile() file: Express.Multer.File
    ) {
        return this.service.addAttachment(req.tenantId, id, file);
    }

    @Delete(':id/attachments/:attachmentId')
    deleteAttachment(
        @Req() req: any,
        @Param('id') id: string,
        @Param('attachmentId') attachmentId: string
    ) {
        return this.service.deleteAttachment(req.tenantId, id, attachmentId);
    }
}
