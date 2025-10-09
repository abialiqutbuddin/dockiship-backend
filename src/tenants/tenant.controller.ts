import { Body, Controller, Delete, ForbiddenException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RbacGuard } from '../common/guards/rbac.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Controller('tenants')
export class TenantController {
  constructor(private readonly tenants: TenantService) {}

  // Create a new tenant for the CURRENT authenticated user (owner)
  @UseGuards(JwtAuthGuard)
  @Post()
  createTenant(@Body() dto: CreateTenantDto, @Req() req: any) {
    return this.tenants.createForUser(req.user.sub, dto);
  }

  // Hard delete (Owner only)
  @UseGuards(TenantGuard, JwtAuthGuard, RbacGuard)
  @Roles('Owner')
  @Delete(':tenantId')
  async hardDelete(@Param('tenantId') tenantId: string, @Req() req: any) {
    const pathTenantId = tenantId;
    const headerTenantId = req.tenantId;
    if (headerTenantId && headerTenantId !== pathTenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }
    return this.tenants.hardDeleteTenant(pathTenantId, req.user.sub);
  }
}