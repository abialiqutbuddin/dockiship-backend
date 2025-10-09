// src/users/user.controller.ts
import {
  Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RbacGuard } from '../common/guards/rbac.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { UserService } from './user.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { SetRolesDto } from './dto/set-roles.dto';
import { CreateMemberDto } from './dto/create-user.dto';

@Controller('users')
@UseGuards(TenantGuard, JwtAuthGuard, RbacGuard)
export class UserController {
  constructor(private readonly users: UserService) {}

  @Get()
  @Roles('Admin','Owner')
  @Permissions('user.manage')
  async listMembers(
    @TenantId() tenantId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('q') search?: string,
  ) {
    return this.users.listMembersByTenant(tenantId, {
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
      search,
    });
  }

  @Post('invite')
  @Roles('Admin','Owner')
  @Permissions('user.manage')
  async invite(@TenantId() tenantId: string, @Body() dto: InviteUserDto) {
    return this.users.inviteUser({
      email: dto.email,
      fullName: dto.fullName,
      tenantId,
      roleIds: dto.roleIds,
    });
  }

  @Post()
  @Roles('Admin','Owner')
  @Permissions('user.manage')
  async createMember(@TenantId() tenantId: string, @Body() dto: CreateMemberDto) {
    return this.users.createMemberWithPassword({
      tenantId,
      email: dto.email,
      fullName: dto.fullName,
      password: dto.password,
      roleIds: dto.roleIds,
    });
  }

  @Put(':userId/roles')
  @Roles('Admin','Owner')
  @Permissions('user.manage','role.manage')
  async setRoles(@TenantId() tenantId: string, @Param('userId') userId: string, @Body() dto: SetRolesDto) {
    return this.users.setRolesForUserInTenant(userId, tenantId, dto.roleIds);
  }

  @Post(':userId/roles/add')
  @Roles('Admin','Owner')
  @Permissions('user.manage','role.manage')
  async addRoles(@TenantId() tenantId: string, @Param('userId') userId: string, @Body() dto: SetRolesDto) {
    return this.users.addRolesForUserInTenant(userId, tenantId, dto.roleIds);
  }

  @Delete(':userId/roles')
  @Roles('Admin','Owner')
  @Permissions('user.manage','role.manage')
  async removeRoles(@TenantId() tenantId: string, @Param('userId') userId: string, @Body() dto: SetRolesDto) {
    return this.users.removeRolesForUserInTenant(userId, tenantId, dto.roleIds);
  }

  @Post(':userId/suspend')
  @Roles('Admin','Owner')
  @Permissions('user.manage')
  async suspendMembership(@TenantId() tenantId: string, @Param('userId') userId: string) {
    return this.users.suspendMembership(userId, tenantId);
  }

  @Post(':userId/activate')
  @Roles('Admin','Owner')
  @Permissions('user.manage')
  async activateMembership(@TenantId() tenantId: string, @Param('userId') userId: string) {
    return this.users.activateMembership(userId, tenantId);
  }
}