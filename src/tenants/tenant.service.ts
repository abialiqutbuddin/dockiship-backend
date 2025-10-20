import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

function slugifyBase(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
function randomSuffix(n = 6) { return Math.random().toString(36).slice(-n); }

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) { }

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
      for (; ;) {
        const clash = await tx.tenant.findFirst({ where: { slug } });
        if (!clash) break;
        slug = `${base}-${randomSuffix(4)}`;
      }

      const tenant = await tx.tenant.create({
        data: { name: safeName, slug, description: dto.description?.trim() || null, currency: 'USD', timezone: 'UTC' },
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
      // 1) Remove role assignments for memberships of this tenant
      await tx.userTenantRole.deleteMany({
        where: { membership: { tenantId } },
      });

      // 2) Remove memberships (detach ALL users from this tenant)
      await tx.userTenant.deleteMany({
        where: { tenantId },
      });

      // 3) Remove tenant-scoped RBAC
      await tx.rolePermission.deleteMany({
        where: { role: { tenantId } },
      });
      await tx.role.deleteMany({
        where: { tenantId },
      });

      // 4) Remove other tenant-scoped data
      await tx.tenantEntitlement.deleteMany({ where: { tenantId } });
      await tx.subscription.deleteMany({ where: { tenantId } });

      // (Add any of your other tenant-scoped tables here, e.g. warehouses, suppliers, etc.)
      // await tx.warehouse.deleteMany({ where: { tenantId } });
      // await tx.supplier.deleteMany({ where: { tenantId } });
      // ...

      // 5) Finally, delete the tenant record
      await tx.tenant.delete({ where: { id: tenantId } });

      // IMPORTANT: Do NOT delete users, regardless of whether they had only this tenant.
    });

    return { message: 'Tenant deleted. All tenant-scoped data removed. Users retained.' };
  }

  async updateTenant(tenantId: string, requesterUserId: string, dto: {
    name?: string;
    description?: string;
    currency?: string;
    timezone?: string;
  }) {
    // Ensure tenant exists
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Ensure requester is an owner of this tenant
    const membership = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId_unique: { userId: requesterUserId, tenantId } },
      select: { isOwner: true },
    });
    if (!membership?.isOwner) {
      throw new ForbiddenException('Only tenant owners can update tenant settings');
    }

    // Normalize currency to UPPER if provided
    const data: any = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency.toUpperCase() } : {}),
      ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
    };

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: { id: true, 
        name: true, 
        slug: true, 
        description: true, 
        currency: true, 
        timezone: true, 
        //updatedAt: true 
      },
    });

    return { message: 'Tenant updated', tenant: updated };
  }
}