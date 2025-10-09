// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const permissions = [
    // Purchases
    { name: 'purchases.create', description: 'Create purchases' },
    { name: 'purchases.read', description: 'View purchases' },
    { name: 'purchases.update', description: 'Edit purchases' },
    { name: 'purchases.delete', description: 'Delete purchases' },

    // Inventory
    { name: 'inventory.create', description: 'Create inventory items' },
    { name: 'inventory.read', description: 'View inventory' },
    { name: 'inventory.update', description: 'Edit inventory' },
    { name: 'inventory.delete', description: 'Delete inventory' },

    // Roles
    { name: 'role.manage', description: 'Manage roles and permissions' },

    // Users
    { name: 'user.manage', description: 'Manage users' },
  ];

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { name: p.name },
      update: {},
      create: p,
    });
  }

  console.log('✅ Permissions seeded successfully');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });