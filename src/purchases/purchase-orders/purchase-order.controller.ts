import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { PurchaseOrderService } from './purchase-order.service';
import { UpdatePurchaseOrderStatusDto } from './dto/update-purchase-order-status.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { ReceivePurchaseOrderItemsDto } from './dto/receive-purchase-order-items.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Controller('purchase-orders')
@UseGuards(TenantGuard, JwtAuthGuard, RbacGuard)
export class PurchaseOrderController {
  constructor(private readonly purchaseOrders: PurchaseOrderService) { }

  @Post()
  @Permissions('purchases.po.create')
  async create(
    @TenantId() tenantId: string,
    @Body() dto: CreatePurchaseOrderDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.sub ?? null;
    return this.purchaseOrders.create(tenantId, userId, dto);
  }

  @Get()
  @Permissions('purchases.po.read', 'purchases.po.create')
  async list(
    @TenantId() tenantId: string,
    @Query('page') page?: number,
    @Query('perPage') perPage?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.purchaseOrders.list(tenantId, {
      page,
      perPage,
      search,
      status,
      supplierId,
      sortBy,
      sortOrder,
    });
  }

  @Get(':id')
  @Permissions('purchases.po.read')
  async findOne(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.purchaseOrders.findOne(tenantId, id);
  }

  @Patch(':id/status')
  @Permissions('purchases.po.update')
  async updateStatus(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderStatusDto,
  ) {
    return this.purchaseOrders.updateStatus(tenantId, id, dto.status, dto.notes);
  }

  @Post(':id/receive')
  @Permissions('purchases.po.update')
  async receiveItems(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: ReceivePurchaseOrderItemsDto,
  ) {
    return this.purchaseOrders.receiveItems(tenantId, id, dto);
  }

  @Patch(':id')
  @Permissions('purchases.po.update')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.sub ?? null;
    return this.purchaseOrders.update(tenantId, userId, id, dto);
  }

  @Patch(':id/payment')
  @Permissions('purchases.po.update')
  async updatePayment(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.purchaseOrders.updatePayment(tenantId, id, dto.amountPaid);
  }
}
