-- AlterTable
ALTER TABLE `ProductVariant` ADD COLUMN `lastPurchaseCurr` VARCHAR(3) NULL,
    ADD COLUMN `lastPurchasePrice` DECIMAL(12, 2) NULL;

-- AlterTable
ALTER TABLE `Role` ALTER COLUMN `updatedAt` DROP DEFAULT;
