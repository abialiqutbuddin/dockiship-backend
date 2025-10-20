// src/rbac/rbac.controller.ts
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RbacService } from './rbac.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RbacGuard } from '../common/guards/rbac.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { UpdateRoleAndPermissionsDto } from './dto/update-role-and-perm.dto';

@Controller('roles')
@UseGuards(TenantGuard, JwtAuthGuard, RbacGuard)
export class RbacController {
  constructor(private readonly rbac: RbacService) { }

  // Create role with optional permissions in one shot
  @Post()
  // Pick ONE of these lines based on your policy:
  // @Roles('Admin','Owner')
  @Permissions('role.manage')
  async createRole(
    @TenantId() tenantId: string,
    @Body() dto: CreateRoleDto,
  ) {
    const role = await this.rbac.createRole(tenantId, dto.name, dto.description);

    if (dto.permissionNames?.length) {
      const perms = await this.rbac.setPermissionsForRole(role.id, tenantId, dto.permissionNames);
      return { ...role, permissions: perms };
    }

    // no perms provided -> empty list
    return { ...role, permissions: [] };
  }

  // Update role metadata
  @Put(':roleId')
  @Permissions('role.manage')
  async updateRole(
    @TenantId() tenantId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rbac.updateRole(tenantId, roleId, dto);
  }

  // Delete role
  @Delete(':roleId')
  @Permissions('role.manage')
  async deleteRole(
    @TenantId() tenantId: string,
    @Param('roleId') roleId: string,
  ) {
    // Fetch role to verify
    const role = await this.rbac.findRoleById(tenantId, roleId);

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Prevent deletion if it's the Owner role
    if (role.name.toLowerCase() === 'owner') {
      throw new ForbiddenException('The Owner role cannot be deleted');
    }

    return this.rbac.deleteRole(tenantId, roleId);
  }

  // List roles (with permissions)
  @Get()
  // @Roles('Admin','Manager','Owner') // or:
  @Permissions('role.manage')
  async listRoles(@TenantId() tenantId: string) {
    return this.rbac.getAllRoles(tenantId);
  }

  // Lightweight role ids
  @Get('ids')
  // @Roles('Admin','Manager','Owner') // or:
  @Permissions('role.manage')
  async listRoleIds(@TenantId() tenantId: string) {
    return this.rbac.getRoleIds(tenantId);
  }

  // Get role permissions (names)
  @Get(':roleId/permissions')
  @Permissions('role.manage')
  async getRolePermissions(
    @TenantId() tenantId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.rbac.listPermissionsForRole(roleId, tenantId);
  }

  // ADD permissions (keep existing)
  @Post(':roleId/permissions/add')
  @Permissions('role.manage')
  async addRolePermissions(
    @TenantId() tenantId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.rbac.addPermissionsToRole(roleId, tenantId, dto.permissionNames);
  }

  // REPLACE permissions (overwrite set)
  @Put(':roleId/permissions')
  @Permissions('role.manage')
  async setRolePermissions(
    @TenantId() tenantId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.rbac.setPermissionsForRole(roleId, tenantId, dto.permissionNames);
  }

  @Put(':roleId')
  updateRoleAndPermissions(
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRoleAndPermissionsDto,
    @TenantId() tenantId: string,
  ) {
    return this.rbac.updateRoleAndPermissions(tenantId, roleId, dto);
  }

  // REMOVE specific permissions
  @Delete(':roleId/permissions')
  @Permissions('role.manage')
  async removeRolePermissions(
    @TenantId() tenantId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.rbac.removePermissionsFromRole(roleId, tenantId, dto.permissionNames);
  }
}