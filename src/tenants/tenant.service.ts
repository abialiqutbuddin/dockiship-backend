import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

function slugifyBase(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
function randomSuffix(n = 6) { return Math.random().toString(36).slice(-n); }

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  private defaultRoleNames(): Array<{ name: string; allPerms: boolean }> {
    return [
      { name: 'Owner', allPerms: true },
      { name: 'Admin', allPerms: true }, // you can narrow later
    ];
  }

  /**
   * Create a new tenant for an existing authenticated user.
   * - Does NOT create a user
   * - Creates tenant, roles, attaches current user as Owner
   */
  async createForUser(userId: string, dto: { tenantName?: string; description?: string }) {
    // Ensure user exists and is active
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, fullName: true, isActive: true } });
    if (!user || !user.isActive) throw new BadRequestException('Invalid user');

    return await this.prisma.$transaction(async (tx) => {
      // Create tenant with unique slug
      const safeName = dto.tenantName?.trim() || `${(user.fullName || 'Tenant').split(' ')[0]}'s Workspace`;
      let base = slugifyBase(safeName) || 'workspace';
      let slug = base;
      for (;;) {
        const clash = await tx.tenant.findFirst({ where: { slug } });
        if (!clash) break;
        slug = `${base}-${randomSuffix(4)}`;
      }

      const tenant = await tx.tenant.create({
        data: { name: safeName, slug, description: dto.description?.trim() || null },
      });

      // Load ALL permissions (must be seeded)
      const allPerms = await tx.permission.findMany({ select: { id: true, name: true } });
      if (allPerms.length === 0) {
        throw new BadRequestException('No permissions found. Run `npx prisma db seed` before creating tenants.');
      }

      // Create default roles
      const roleDefs = this.defaultRoleNames();
      await tx.role.createMany({
        data: roleDefs.map((r) => ({ name: r.name, tenantId: tenant.id })),
        skipDuplicates: true,
      });
      const roles = await tx.role.findMany({
        where: { tenantId: tenant.id, name: { in: roleDefs.map((r) => r.name) } },
        select: { id: true, name: true },
      });

      // Link perms to roles (Owner/Admin get ALL perms for now)
      const rolePermRows = roles.flatMap((role) => {
        const def = roleDefs.find((r) => r.name === role.name)!;
        const permsForRole = def.allPerms ? allPerms : [];
        return permsForRole.map((p) => ({ roleId: role.id, permissionId: p.id }));
      });
      if (rolePermRows.length) {
        await tx.rolePermission.createMany({ data: rolePermRows, skipDuplicates: true });
      }

      // Create owner membership + assign Owner role
      const membership = await tx.userTenant.create({
        data: { userId: user.id, tenantId: tenant.id, isOwner: true, status: 'active' },
      });
      const ownerRole = roles.find((r) => r.name === 'Owner') ?? roles[0];
      await tx.userTenantRole.create({
        data: { userTenantId: membership.id, roleId: ownerRole.id },
      });

      return {
        message: 'Tenant created successfully',
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
      };
    });
  }

  // (keep your existing hardDeleteTenant exactly as you already posted)
  async hardDeleteTenant(tenantId: string, requesterUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const ownerMembership = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId_unique: { userId: requesterUserId, tenantId } },
      select: { isOwner: true },
    });
    if (!ownerMembership?.isOwner) {
      throw new ForbiddenException('Only tenant owners can delete the tenant');
    }

    await this.prisma.$transaction(async (tx) => {
      const memberships = await tx.userTenant.findMany({
        where: { tenantId },
        select: { id: true, userId: true },
      });
      const userIds = [...new Set(memberships.map((m) => m.userId))];

      let usersToDelete: string[] = [];
      if (userIds.length) {
        const grouped = await tx.userTenant.groupBy({
          by: ['userId'],
          where: { userId: { in: userIds } },
          _count: { _all: true },
        });
        usersToDelete = grouped.filter((g) => g._count._all === 1).map((g) => g.userId);
      }

      await tx.userTenantRole.deleteMany({ where: { membership: { tenantId } } });
      await tx.userTenant.deleteMany({ where: { tenantId } });
      await tx.rolePermission.deleteMany({ where: { role: { tenantId } } });
      await tx.role.deleteMany({ where: { tenantId } });
      await tx.tenantEntitlement.deleteMany({ where: { tenantId } });
      await tx.subscription.deleteMany({ where: { tenantId } });
      await tx.tenant.delete({ where: { id: tenantId } });

      if (usersToDelete.length) {
        await tx.user.deleteMany({ where: { id: { in: usersToDelete } } });
      }
    });

    return { message: 'Tenant and related data deleted permanently' };
  }
}