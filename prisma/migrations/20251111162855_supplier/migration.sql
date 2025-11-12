/*
  Warnings:

  - You are about to drop the column `primarySupplierId` on the `Product` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `Product` DROP FOREIGN KEY `Product_primarySupplierId_fkey`;

-- DropIndex
DROP INDEX `Product_primarySupplierId_fkey` ON `Product`;

-- AlterTable
ALTER TABLE `Product` DROP COLUMN `primarySupplierId`;

-- AlterTable
ALTER TABLE `ProductSupplier` ADD COLUMN `lastPurchaseCurr` VARCHAR(3) NULL,
    ADD COLUMN `lastPurchasePrice` DECIMAL(12, 2) NULL;

-- AlterTable
ALTER TABLE `Role` ALTER COLUMN `updatedAt` DROP DEFAULT;
