import { Controller, Get, UseGuards } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RbacGuard } from '../common/guards/rbac.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';

@Controller('permissions')
@UseGuards(TenantGuard, JwtAuthGuard, RbacGuard)
export class PermissionsController {
  constructor(private readonly perms: PermissionsService) {}

  @Get()
  @Roles('Admin', 'Manager', 'Owner')
  @Permissions('role.manage', 'user.manage')
  async listAll(@TenantId() tenantId: string) {
    return this.perms.getAll(tenantId);
  }
}