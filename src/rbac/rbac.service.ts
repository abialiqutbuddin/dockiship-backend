import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  // ----------------- Helpers -----------------

  private async assertRoleInTenant(roleId: string, tenantId: string) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, tenantId } });
    if (!role) throw new NotFoundException('Role not found for this tenant');
    return role;
  }

  private async getPermissionIdsByNames(names: string[]) {
    const perms = await this.prisma.permission.findMany({ where: { name: { in: names } } });
    const foundNames = new Set(perms.map((p) => p.name));
    const missing = names.filter((n) => !foundNames.has(n));
    if (missing.length) {
      throw new BadRequestException(`Unknown permissions: ${missing.join(', ')}`);
    }
    return perms.map((p) => p.id);
  }

  private async getMembershipOrThrow(userId: string, tenantId: string) {
    const membership = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId_unique: { userId, tenantId } },
    });
    if (!membership) throw new NotFoundException('User is not a member of this tenant');
    return membership;
  }

  // ----------------- Roles (tenant-scoped) -----------------

  // Get role by name (tenant-scoped)
  getRoleByName(tenantId: string, name: string) {
    return this.prisma.role.findFirst({
      where: { tenantId, name },
      include: { rolePerms: { include: { permission: true } } },
    });
  }

  // Create role
  async createRole(tenantId: string, name: string, description?: string) {
    try {
      const role = await this.prisma.role.create({
        data: { name, description, tenantId },
      });
      return role;
    } catch (e: any) {
      // respects @@unique([name, tenantId])
      if (e.code === 'P2002') throw new BadRequestException('Role with this name already exists');
      throw e;
    }
  }

  // Update role (rename / description)
  async updateRole(tenantId: string, roleId: string, data: { name?: string; description?: string }) {
    await this.assertRoleInTenant(roleId, tenantId);
    try {
      const role = await this.prisma.role.update({
        where: { id: roleId },
        data: { name: data.name, description: data.description },
      });
      return role;
    } catch (e: any) {
      if (e.code === 'P2002') throw new BadRequestException('Role with this name already exists');
      throw e;
    }
  }

  // Delete role (and its links)
  async deleteRole(tenantId: string, roleId: string) {
    await this.assertRoleInTenant(roleId, tenantId);
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.userTenantRole.deleteMany({ where: { roleId } }),
      this.prisma.role.delete({ where: { id: roleId } }),
    ]);
    return { ok: true };
  }

  // Get all roles for a tenant
  async getAllRoles(tenantId: string) {
    const roles = await this.prisma.role.findMany({
      where: { tenantId },
      include: { rolePerms: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      permissions: r.rolePerms.map((rp) => rp.permission.name),
    }));
  }

  // Get role IDs only (lightweight)
  async getRoleIds(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
      orderBy: { name: 'asc' },
    });
  }

  // ----------------- Role ↔ Permission (global perms) -----------------

  async listPermissionsForRole(roleId: string, tenantId: string) {
    await this.assertRoleInTenant(roleId, tenantId);
    const links = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
      orderBy: { permission: { name: 'asc' } },
    });
    return links.map((rp) => rp.permission.name);
  }

  // ADD permissions (keep existing)
  async addPermissionsToRole(roleId: string, tenantId: string, permissionNames: string[]) {
    await this.assertRoleInTenant(roleId, tenantId);
    const permissionIds = await this.getPermissionIdsByNames(permissionNames);

    await this.prisma.rolePermission.createMany({
      data: permissionIds.map((pid) => ({ roleId, permissionId: pid })),
      skipDuplicates: true, // relies on @@unique([roleId, permissionId])
    });

    return this.listPermissionsForRole(roleId, tenantId);
  }

  // REPLACE permissions (overwrite)
  async setPermissionsForRole(roleId: string, tenantId: string, permissionNames: string[]) {
    await this.assertRoleInTenant(roleId, tenantId);
    const permissionIds = await this.getPermissionIdsByNames(permissionNames);

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: permissionIds.map((pid) => ({ roleId, permissionId: pid })),
        skipDuplicates: true,
      }),
    ]);

    return this.listPermissionsForRole(roleId, tenantId);
  }

  async findRoleById(tenantId: string, roleId: string) {
  return this.prisma.role.findFirst({
    where: { id: roleId, tenantId },
  });
}

  // update role and permissions
async updateRoleAndPermissions(
  tenantId: string,
  roleId: string,
  dto: { name?: string; description?: string; permissionNames?: string[] } // <- make optional
) {
  await this.assertRoleInTenant(roleId, tenantId);

  // If the caller didn't send permissionNames at all -> don't touch permissions.
  const touchPermissions = Array.isArray(dto.permissionNames);

  // Prepare the meta update (name/description) first
  const roleMetaUpdate = this.prisma.role.update({
    where: { id: roleId },
    data: {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
    },
  });

  try {
    if (!touchPermissions) {
      // Only update meta; leave permissions as-is
      await roleMetaUpdate;
      return this.listPermissionsForRole(roleId, tenantId);
    }

    // permissionNames provided:
    const names = dto.permissionNames!;

    if (names.length === 0) {
      // Explicitly clear all permissions
      await this.prisma.$transaction([
        roleMetaUpdate,
        this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      ]);
      return {'ok':true}; // now the role has zero permissions
    }

    // Non-empty -> validate + replace
    const permissionIds = await this.getPermissionIdsByNames(names);

    await this.prisma.$transaction([
      roleMetaUpdate,
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      // Guard: createMany with data: [] is a no-op; we know it's non-empty here
      this.prisma.rolePermission.createMany({
        data: permissionIds.map((pid) => ({ roleId, permissionId: pid })),
        skipDuplicates: true,
      }),
    ]);
  } catch (e: any) {
    if (e.code === 'P2002') {
      // respects @@unique([name, tenantId])
      throw new BadRequestException('Role with this name already exists');
    }
    throw e;
  }

  return this.listPermissionsForRole(roleId, tenantId);
}

  // REMOVE given permissions
  async removePermissionsFromRole(roleId: string, tenantId: string, permissionNames: string[]) {
    await this.assertRoleInTenant(roleId, tenantId);
    const permissionIds = await this.getPermissionIdsByNames(permissionNames);

    await this.prisma.rolePermission.deleteMany({
      where: { roleId, permissionId: { in: permissionIds } },
    });

    return this.listPermissionsForRole(roleId, tenantId);
  }

  // ----------------- Membership ↔ Role (UserTenantRole) -----------------

  /**
   * Set roles for a USER within a TENANT (replace set).
   * Finds the membership (UserTenant), then rewires UserTenantRole rows.
   */
  async setRolesForUserInTenant(userId: string, tenantId: string, roleIds: string[]) {
    // Ensure roles belong to tenant
    const roles = await this.prisma.role.findMany({ where: { id: { in: roleIds }, tenantId } });
    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more roles do not belong to this tenant');
    }

    const membership = await this.getMembershipOrThrow(userId, tenantId);

    await this.prisma.$transaction([
      this.prisma.userTenantRole.deleteMany({ where: { userTenantId: membership.id } }),
      this.prisma.userTenantRole.createMany({
        data: roleIds.map((roleId) => ({ userTenantId: membership.id, roleId })),
      }),
    ]);

    return { ok: true };
  }

  /**
   * Add roles (keep existing) for a USER within a TENANT.
   */
  async addRolesForUserInTenant(userId: string, tenantId: string, roleIds: string[]) {
    const roles = await this.prisma.role.findMany({ where: { id: { in: roleIds }, tenantId } });
    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more roles do not belong to this tenant');
    }

    const membership = await this.getMembershipOrThrow(userId, tenantId);

    await this.prisma.userTenantRole.createMany({
      data: roleIds.map((roleId) => ({ userTenantId: membership.id, roleId })),
      skipDuplicates: true, // relies on @@unique([userTenantId, roleId])
    });

    return { ok: true };
  }

  /**
   * Remove specific roles for a USER within a TENANT.
   */
  async removeRolesForUserInTenant(userId: string, tenantId: string, roleIds: string[]) {
    const membership = await this.getMembershipOrThrow(userId, tenantId);
    await this.prisma.userTenantRole.deleteMany({
      where: { userTenantId: membership.id, roleId: { in: roleIds } },
    });
    return { ok: true };
  }

  /**
   * List a USER's roles (names) within a TENANT.
   */
  async listUserRolesInTenant(userId: string, tenantId: string) {
    const membership = await this.getMembershipOrThrow(userId, tenantId);
    const rows = await this.prisma.userTenantRole.findMany({
      where: { userTenantId: membership.id },
      include: { role: true },
      orderBy: { role: { name: 'asc' } },
    });
    return rows.map((r) => r.role.name);
  }
}