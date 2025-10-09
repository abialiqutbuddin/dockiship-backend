// src/tenants/tenant.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';

@Module({
  imports: [PrismaModule],
  providers: [TenantService],
  controllers: [TenantController],
  exports: [TenantService],
})
export class TenantsModule {}