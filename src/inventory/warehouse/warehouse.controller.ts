import {
  Body, Controller, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

@Controller('warehouses')
@UseGuards(TenantGuard, JwtAuthGuard, RbacGuard)
export class WarehouseController {
  constructor(private readonly warehouses: WarehouseService) { }

  @Post()
  @Roles('Admin', 'Owner')
  @Permissions('warehouses.manage')
  async create(@TenantId() tenantId: string, @Body() dto: CreateWarehouseDto) {
    return this.warehouses.create(tenantId, dto);
  }

  @Get()
  @Roles('Admin', 'Owner')
  @Permissions('warehouses.read')
  async list(@TenantId() tenantId: string, @Query() query: any) {
    return this.warehouses.list(tenantId, query);
  }

  @Get(':id')
  @Roles('Admin', 'Owner')
  @Permissions('warehouses.read')
  async getOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.warehouses.getById(tenantId, id);
  }

  @Patch(':id')
  @Roles('Admin', 'Owner')
  @Permissions('warehouses.manage')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.warehouses.update(tenantId, id, dto);
  }

  @Get(':id/stock')
  @Roles('Admin', 'Owner')
  @Permissions('warehouses.read')
  async getStock(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.warehouses.getWarehouseStock(tenantId, id);
  }

  @Patch(':id/archive')
  @Roles('Admin', 'Owner')
  @Permissions('warehouses.manage')
  async archive(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.warehouses.archive(tenantId, id);
  }
}