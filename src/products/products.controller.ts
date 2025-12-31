// ---------------------------------------------
// src/products/products.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards, UseInterceptors, UploadedFiles } from '@nestjs/common';
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
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import { join, extname } from 'path';
import { promises as fs } from 'fs';
import { CreateChannelDto, CreateListingForProductDto, CreateListingForVariantDto, ListChannelQueryDto, ListProductNameQueryDto } from './dto/marketplace.dto';

@Controller('products')
@UseGuards(TenantGuard, JwtAuthGuard, RbacGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) { }

  // CREATE PRODUCT
  @Post()
  @Permissions('inventory.product.manage')
  create(@Req() req: any, @Body() dto: CreateProductDto) {
    return this.products.createProduct(req.tenantId, dto);
  }

  // LIST PRODUCTS (paginated)
  @Get()
  @Permissions('inventory.product.read', 'inventory.product.manage')
  list(@Req() req: any, @Query() q: ListProductsQueryDto) {
    return this.products.listProducts(req.tenantId, q);
  }

  @Patch(':productId/full')
  @Permissions('inventory.product.manage')
  updateWithVariants(
    @Req() req: any,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductWithVariantsDto
  ) {
    return this.products.updateProductWithVariants(req.tenantId, productId, dto);
  }

  // GET ONE
  @Get(':productId')
  @Permissions('inventory.product.read', 'inventory.product.manage')
  getOne(@Req() req: any, @Param('productId') productId: string) {
    return this.products.getProduct(req.tenantId, productId);
  }

  // UPDATE
  @Patch(':productId')
  @Permissions('inventory.product.manage')
  update(@Req() req: any, @Param('productId') productId: string, @Body() dto: UpdateProductDto) {
    return this.products.updateProduct(req.tenantId, productId, dto);
  }

  // DELETE
  @Delete(':productId')
  @Permissions('inventory.product.manage')
  remove(@Req() req: any, @Param('productId') productId: string) {
    return this.products.deleteProduct(req.tenantId, productId);
  }

  // PUBLISH / UNPUBLISH
  @Post(':productId/publish')
  @Permissions('inventory.product.manage')
  publish(@Req() req: any, @Param('productId') productId: string) {
    return this.products.publish(req.tenantId, productId);
  }
  @Post(':productId/unpublish')
  @Permissions('inventory.product.manage')
  unpublish(@Req() req: any, @Param('productId') productId: string) {
    return this.products.unpublish(req.tenantId, productId);
  }

  // VARIANTS -------------------------------------
  @Post(':productId/variants')
  @Permissions('inventory.product.manage')
  addVariant(@Req() req: any, @Param('productId') productId: string, @Body() dto: CreateVariantDto) {
    return this.products.addVariant(req.tenantId, productId, dto);
  }

  @Patch(':productId/variants/:variantId')
  @Permissions('inventory.product.manage')
  updateVariant(
    @Req() req: any,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.products.updateVariant(req.tenantId, productId, variantId, dto);
  }

  @Delete(':productId/variants/:variantId')
  @Permissions('inventory.product.manage')
  removeVariant(@Req() req: any, @Param('productId') productId: string, @Param('variantId') variantId: string) {
    return this.products.removeVariant(req.tenantId, productId, variantId);
  }

  // CATEGORIES --------------------------------
  @Get('/meta/categories')
  @Permissions('inventory.product.read', 'inventory.product.manage')
  listCategories(@Req() req: any, @Query('search') search?: string) {
    return this.products.listCategories(req.tenantId, search);
  }

  @Post('/meta/categories')
  @Permissions('inventory.product.manage')
  createCategory(@Req() req: any, @Body('name') name: string) {
    return this.products.createCategory(req.tenantId, name);
  }

  // ENUMS / SIZES --------------------------------
  @Get('/meta/enums')
  @Permissions('inventory.product.read', 'inventory.product.manage')
  getEnums() {
    return this.products.enums();
  }

  @Get('/meta/sizes')
  @Permissions('inventory.product.read', 'inventory.product.manage')
  listSizes(@Req() req: any, @Query('search') search?: string) {
    return this.products.listSizes(req.tenantId, search);
  }

  // IMAGES -------------------------------------------------
  @Get(':productId/images')
  @Permissions('inventory.product.read', 'inventory.product.manage')
  async listImages(@Req() req: any, @Param('productId') productId: string) {
    return this.products.listProductImages(req.tenantId, productId);
  }

  @Post(':productId/images')
  @Permissions('inventory.product.manage')
  @UseInterceptors(FilesInterceptor('images', 10, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB per file
    },
    storage: diskStorage({
      destination: (
        req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, destination: string) => void,
      ) => {
        try {
          const anyReq = req as any;
          const tenantId = anyReq.tenantId as string;
          const productId = anyReq.params?.productId as string;
          const variantId = (anyReq.query?.variantId || anyReq.body?.variantId) as string | undefined;
          const segments = [process.cwd(), 'uploads', `${tenantId}-${productId}`];
          if (variantId) segments.push(variantId);
          const dest = join(...segments);
          fs.mkdir(dest, { recursive: true })
            .then(() => cb(null, dest))
            .catch((e) => cb(e as any, 'uploads'));
        } catch (e) {
          cb(e as any, 'uploads');
        }
      },
      filename: (
        req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, filename: string) => void,
      ) => {
        const base = String(file.originalname || 'image')
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9_\.-]/g, '')
          .replace(/\.+/g, '.')
          .slice(0, 80);
        const ext = extname(base) || '.jpg';
        const name = base.replace(ext, '') || 'image';
        const stamp = Date.now();
        cb(null, `${name}-${stamp}${ext.toLowerCase()}`);
      }
    })
  }))
  async uploadImages(
    @Req() req: Request & { tenantId: string },
    @Param('productId') productId: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Query('variantId') variantId?: string,
  ) {
    if (!Array.isArray(files) || files.length === 0) return [];
    const tenantId = req.tenantId as string;
    // Build URLs that match static serving path
    const urls = files.map((f) => {
      const parts = [`${tenantId}-${productId}`];
      const vId = variantId || (req.body?.variantId as string | undefined);
      if (vId) parts.push(vId);
      return '/uploads/' + [...parts, f.filename].join('/');
    });
    return this.products.addProductImages(tenantId, productId, urls);
  }

  @Delete(':productId/images/:imageId')
  @Permissions('inventory.product.manage')
  async removeImage(
    @Req() req: any,
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.products.removeProductImage(req.tenantId, productId, imageId);
  }


  ///MARKET PLACE CHANNELS AND LISTINGS -------------------------------------
  // Product Names (searchable from listings)
  @Get('/marketplaces/product-names')
  @Permissions('inventory.product.manage')
  getListingProductNames(@Req() req: any, @Query() q: ListProductNameQueryDto) {
    return this.products.listListingProductNames(req.tenantId, q?.q);
  }

  // Channels (marketplaces)
  @Get('/marketplaces/channels')
  @Permissions('inventory.product.manage')
  getMarketplaceChannels(@Req() req: any, @Query() q: ListChannelQueryDto) {
    return this.products.listMarketplaceChannels(req.tenantId, q?.q);
  }

  // Create channel (marketplace). Idempotent: returns existing if unique hit.
  @Post('/marketplaces/channels')
  @Permissions('inventory.product.manage')
  createMarketplaceChannel(@Req() req: any, @Body() dto: CreateChannelDto) {
    return this.products.createMarketplaceChannel(req.tenantId, dto);
  }

  // List all listings for a product (parent + per-variant)
  @Get(':productId/marketplaces/listings')
  @Permissions('inventory.product.read')
  listMarketplaceListings(
    @Req() req: any,
    @Param('productId') productId: string,
  ) {
    return this.products.listProductListings(req.tenantId, productId);
  }

  // Create a listing for the PARENT product
  @Post(':productId/marketplaces/listings/product')
  @Permissions('inventory.product.manage')
  addMarketplaceListingForProduct(
    @Req() req: any,
    @Param('productId') productId: string,
    @Body() dto: CreateListingForProductDto,
  ) {
    return this.products.addProductListing(req.tenantId, productId, dto);
  }

  // Create a listing for a SPECIFIC VARIANT
  @Post(':productId/marketplaces/listings/variant')
  @Permissions('inventory.product.manage')
  addMarketplaceListingForVariant(
    @Req() req: any,
    @Param('productId') productId: string,
    @Body() dto: CreateListingForVariantDto,
  ) {
    return this.products.addVariantListing(req.tenantId, productId, dto);
  }

  @Delete(':productId/marketplaces/listings/:listingId')
  @Permissions('inventory.product.manage')
  deleteMarketplaceListing(
    @Req() req: any,
    @Param('productId') productId: string,
    @Param('listingId') listingId: string,
  ) {
    return this.products.deleteListing(req.tenantId, productId, listingId);
  }

}
