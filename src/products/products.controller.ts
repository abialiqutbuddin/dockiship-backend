// ---------------------------------------------
// src/products/products.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RbacGuard } from '../common/guards/rbac.guard';
import { CreateProductDto } from './dto/create-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductsQueryDto } from './dto/list-products.dto';
import { CreateVariantDto } from './dto/create-products.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UpdateProductWithVariantsDto } from './dto/update-product-with-variants.dto';

@Controller('products')
@UseGuards(TenantGuard, JwtAuthGuard, RbacGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) { }

  // CREATE PRODUCT
  @Post()
  @Permissions('inventory.products.create') // <-- replace as needed
  create(@Req() req: any, @Body() dto: CreateProductDto) {
    return this.products.createProduct(req.tenantId, dto);
  }

  // LIST PRODUCTS (paginated)
  @Get()
  @Permissions('inventory.products.read')
  list(@Req() req: any, @Query() q: ListProductsQueryDto) {
    return this.products.listProducts(req.tenantId, q);
  }

  @Patch(':productId/full')
  @Permissions('inventory.products.update')
  updateWithVariants(
    @Req() req: any,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductWithVariantsDto
  ) {
    return this.products.updateProductWithVariants(req.tenantId, productId, dto);
  }

  // GET ONE
  @Get(':productId')
  @Permissions('inventory.products.read')
  getOne(@Req() req: any, @Param('productId') productId: string) {
    return this.products.getProduct(req.tenantId, productId);
  }

  // UPDATE
  @Patch(':productId')
  @Permissions('inventory.products.update')
  update(@Req() req: any, @Param('productId') productId: string, @Body() dto: UpdateProductDto) {
    return this.products.updateProduct(req.tenantId, productId, dto);
  }

  // DELETE
  @Delete(':productId')
  @Permissions('inventory.products.delete')
  remove(@Req() req: any, @Param('productId') productId: string) {
    return this.products.deleteProduct(req.tenantId, productId);
  }

  // PUBLISH / UNPUBLISH
  @Post(':productId/publish')
  @Permissions('inventory.products.publish')
  publish(@Req() req: any, @Param('productId') productId: string) {
    return this.products.publish(req.tenantId, productId);
  }
  @Post(':productId/unpublish')
  @Permissions('inventory.products.publish')
  unpublish(@Req() req: any, @Param('productId') productId: string) {
    return this.products.unpublish(req.tenantId, productId);
  }

  // VARIANTS -------------------------------------
  @Post(':productId/variants')
  @Permissions('inventory.variants.create')
  addVariant(@Req() req: any, @Param('productId') productId: string, @Body() dto: CreateVariantDto) {
    return this.products.addVariant(req.tenantId, productId, dto);
  }

  @Patch(':productId/variants/:variantId')
  @Permissions('inventory.variants.update')
  updateVariant(
    @Req() req: any,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.products.updateVariant(req.tenantId, productId, variantId, dto);
  }

  @Delete(':productId/variants/:variantId')
  @Permissions('inventory.variants.delete')
  removeVariant(@Req() req: any, @Param('productId') productId: string, @Param('variantId') variantId: string) {
    return this.products.removeVariant(req.tenantId, productId, variantId);
  }

  // ENUMS / SIZES --------------------------------
  @Get('/meta/enums')
  @Permissions('inventory.products.read')
  getEnums() {
    return this.products.enums();
  }

  @Get('/meta/sizes')
  @Permissions('inventory.products.read')
  listSizes(@Req() req: any, @Query('search') search?: string) {
    return this.products.listSizes(req.tenantId, search);
  }
}
