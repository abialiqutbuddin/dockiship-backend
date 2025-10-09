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

    return perms.map((p) => ({
      id: p.id,
      name: p.name,
      module: p.name.split('.')[0], // e.g. inventory.create → inventory
      action: p.name.split('.')[1], // e.g. inventory.create → create
    }));
  }
}