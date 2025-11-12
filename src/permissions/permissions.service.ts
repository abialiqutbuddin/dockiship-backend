import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  // 🔹 Get all permissions (global or tenant-specific)
  async getAll(tenantId?: string) {
    // currently permissions are global — no tenantId needed
    const perms = await this.prisma.permission.findMany({
      orderBy: { name: 'asc' },
    });

    return perms.map((p) => {
      const parts = (p.name || '').split('.').filter(Boolean);
      const action = parts.length > 0 ? parts[parts.length - 1] : '';
      const module = parts.length > 1 ? parts.slice(0, -1).join('.') : parts[0] || '';
      return {
        id: p.id,
        name: p.name,
        module,
        action,
      };
    });
  }
}
