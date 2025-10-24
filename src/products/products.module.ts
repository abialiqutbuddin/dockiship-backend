// src/products/products.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';

@Module({
  imports: [PrismaModule],
  providers: [ProductsService],
  controllers: [ProductsController],
  exports: [ProductsService],
})
export class ProductsModule {}
