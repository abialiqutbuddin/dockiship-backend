import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Controller('suppliers')
@UseGuards(TenantGuard, JwtAuthGuard, RbacGuard)
export class SupplierController {
  constructor(private readonly suppliers: SupplierService) {}

  @Post()
  @Permissions('suppliers.manage')
  async create(@TenantId() tenantId: string, @Body() dto: CreateSupplierDto) {
    return this.suppliers.create(tenantId, dto);
  }

  @Get()
  @Permissions('suppliers.read', 'suppliers.manage')
  async list(@TenantId() tenantId: string) {
    return this.suppliers.list(tenantId);
  }

  @Get(':id')
  @Permissions('suppliers.read', 'suppliers.manage')
  async getOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.suppliers.getById(tenantId, id);
  }

  @Patch(':id')
  @Permissions('suppliers.manage')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliers.update(tenantId, id, dto);
  }

  @Patch(':id/archive')
  @Permissions('suppliers.manage')
  async archive(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.suppliers.archive(tenantId, id);
  }

    // GET /suppliers/:id/products
  @Get(':id/products')
  @Permissions('suppliers.read', 'suppliers.manage')
  async listProducts(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query('q') q?: string,        // optional search
  ) {
    return this.suppliers.listProducts(tenantId, id, q);
  }

  // DELETE /suppliers/:id/products/:productId  (unlink)
  @Delete(':id/products/:productId')
  @Permissions('suppliers.manage')
  async unlinkProduct(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('productId') productId: string,
  ) {
    return this.suppliers.unlinkProduct(tenantId, id, productId);
  }

  // POST /suppliers/:id/products  (link products to supplier)
  @Post(':id/products')
  @Permissions('suppliers.manage')
  async linkProducts(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body('productIds') productIds: string[] = [],
    @Body('lastPurchasePrice') lastPurchasePrice?: number,
    @Body('currency') currency?: string,
  ) {
    return this.suppliers.linkProducts(tenantId, id, productIds, { lastPurchasePrice, currency });
  }

}
