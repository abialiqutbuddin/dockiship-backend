import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configValidationSchema } from './config/validation';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/user.module';
import { TenantsModule } from './tenants/tenant.module';
import { RbacModule } from './rbac/rbac.module';
import { PermissionsModule } from './permissions/permissions.module';
import { SupplierModule } from './inventory/suppliers/supplier.module';
import { WarehouseModule } from './inventory/warehouse/warehouse.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: configValidationSchema }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RbacModule,
    TenantsModule,
    PermissionsModule,
    SupplierModule,
    WarehouseModule,
    ProductsModule
  ],
})
export class AppModule {}