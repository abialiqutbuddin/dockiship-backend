-- AlterTable
ALTER TABLE `InventoryTxn` ADD COLUMN `productVariantId` VARCHAR(191) NULL,
    MODIFY `productId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `condition` ENUM('NEW', 'USED', 'RECONDITIONED') NOT NULL DEFAULT 'NEW',
    ADD COLUMN `isDraft` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `publishedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `PurchaseOrderItem` ADD COLUMN `productVariantId` VARCHAR(191) NULL,
    MODIFY `productId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Role` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- CreateTable
CREATE TABLE `Size` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    INDEX `Size_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `Size_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductVariant` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NOT NULL,
    `sizeId` VARCHAR(191) NULL,
    `sizeText` VARCHAR(191) NULL,
    `barcode` VARCHAR(191) NULL,
    `status` ENUM('active', 'inactive', 'archived') NOT NULL DEFAULT 'active',
    `condition` ENUM('NEW', 'USED', 'RECONDITIONED') NOT NULL DEFAULT 'NEW',
    `isDraft` BOOLEAN NOT NULL DEFAULT false,
    `publishedAt` DATETIME(3) NULL,
    `weight` DECIMAL(10, 3) NULL,
    `weightUnit` ENUM('g', 'kg', 'lb') NULL,
    `length` DECIMAL(10, 2) NULL,
    `width` DECIMAL(10, 2) NULL,
    `height` DECIMAL(10, 2) NULL,
    `dimensionUnit` ENUM('mm', 'cm', 'inch') NULL,
    `attributes` JSON NULL,

    INDEX `ProductVariant_productId_idx`(`productId`),
    INDEX `ProductVariant_status_idx`(`status`),
    UNIQUE INDEX `ProductVariant_productId_sku_key`(`productId`, `sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `InventoryTxn_productVariantId_idx` ON `InventoryTxn`(`productVariantId`);

-- CreateIndex
CREATE INDEX `PurchaseOrderItem_productVariantId_idx` ON `PurchaseOrderItem`(`productVariantId`);

-- AddForeignKey
ALTER TABLE `PurchaseOrderItem` ADD CONSTRAINT `PurchaseOrderItem_productVariantId_fkey` FOREIGN KEY (`productVariantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryTxn` ADD CONSTRAINT `InventoryTxn_productVariantId_fkey` FOREIGN KEY (`productVariantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Size` ADD CONSTRAINT `Size_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductVariant` ADD CONSTRAINT `ProductVariant_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductVariant` ADD CONSTRAINT `ProductVariant_sizeId_fkey` FOREIGN KEY (`sizeId`) REFERENCES `Size`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
