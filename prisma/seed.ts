// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // --- Existing permissions (kept) ---
  const basePermissions = [
    // Purchases (legacy)
    { name: 'purchases.create', description: 'Create purchases' },
    { name: 'purchases.read',   description: 'View purchases' },
    { name: 'purchases.update', description: 'Edit purchases' },
    { name: 'purchases.delete', description: 'Delete purchases' },

    // Inventory (legacy, generic)
    { name: 'inventory.create', description: 'Create inventory items' },
    { name: 'inventory.read',   description: 'View inventory' },
    { name: 'inventory.update', description: 'Edit inventory' },
    { name: 'inventory.delete', description: 'Delete inventory' },

    // RBAC / Users
    { name: 'role.manage',      description: 'Manage roles and permissions' },
    { name: 'user.manage',      description: 'Manage users' },
  ];

  // --- New permissions for the new modules (additive) ---
  const newPermissions = [
    // Suppliers
    { name: 'suppliers.read',   description: 'View suppliers' },
    { name: 'suppliers.manage', description: 'Create/update/archive suppliers' },

    // Warehouses
    { name: 'warehouses.read',   description: 'View warehouses' },
    { name: 'warehouses.manage', description: 'Create/update/archive warehouses' },

    // Products (more explicit than generic inventory.*)
    { name: 'inventory.product.read',   description: 'View products' },
    { name: 'inventory.product.manage', description: 'Create/update/archive products' },

    // Stock operations (ledger-driven)
    { name: 'inventory.stock.adjust',   description: 'Manual stock adjustments' },
    { name: 'inventory.stock.reserve',  description: 'Reserve/release stock' },
    { name: 'inventory.stock.transfer', description: 'Transfer stock between warehouses' },

    // Purchase Orders (explicit verbs)
    { name: 'purchases.po.create', description: 'Create purchase orders' },
    { name: 'purchases.po.read',   description: 'View purchase orders' },
    { name: 'purchases.po.update', description: 'Edit/update purchase orders' },
    { name: 'purchases.po.receive',description: 'Receive/close purchase orders' },
    { name: 'purchases.po.cancel', description: 'Cancel purchase orders' },
  ];

  // Merge (avoid accidental duplicates in this array)
  const all = [...basePermissions, ...newPermissions]
    .reduce<Record<string, { name: string; description?: string }>>((acc, p) => {
      if (!acc[p.name]) acc[p.name] = p;
      return acc;
    }, {});

  // Idempotent upserts – ignore existing, add only missing
  for (const p of Object.values(all)) {
    await prisma.permission.upsert({
      where: { name: p.name },
      update: {},          // do not overwrite existing descriptions
      create: p,
    });
  }

  console.log(`✅ Permissions seeded (total: ${Object.keys(all).length}). Existing kept, new added.`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });