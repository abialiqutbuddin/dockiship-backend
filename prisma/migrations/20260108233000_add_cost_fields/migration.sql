-- AlterTable
ALTER TABLE `ProductVariant` ADD COLUMN `avgCostPerUnit` DECIMAL(12, 4) NULL;

-- AlterTable
ALTER TABLE `PurchaseOrderItem` ADD COLUMN `allocatedShipping` DECIMAL(12, 2) NULL,
    ADD COLUMN `landedCostPerUnit` DECIMAL(12, 4) NULL;
