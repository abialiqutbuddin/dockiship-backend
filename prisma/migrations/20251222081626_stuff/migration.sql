/*
  Warnings:

  - The values [submitted,sent] on the enum `PurchaseOrder_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `ChannelListing` ADD COLUMN `productName` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `condition` ENUM('NEW', 'USED', 'RECONDITIONED') NULL,
    ADD COLUMN `tag` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `PurchaseOrder` ADD COLUMN `amountPaid` DECIMAL(12, 2) NULL DEFAULT 0,
    MODIFY `status` ENUM('draft', 'to_purchase', 'in_transit', 'partially_received', 'received', 'canceled') NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE `TenantChannel` MODIFY `provider` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `PurchaseOrderTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` VARCHAR(191) NULL,
    `reference` VARCHAR(191) NULL,
    `method` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PurchaseOrderTransaction_purchaseOrderId_idx`(`purchaseOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PurchaseOrderTransaction` ADD CONSTRAINT `PurchaseOrderTransaction_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
