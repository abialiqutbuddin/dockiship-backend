-- AlterTable
ALTER TABLE `PurchaseOrder` ADD COLUMN `productTax` DECIMAL(12, 2) NULL,
    ADD COLUMN `shippingCost` DECIMAL(12, 2) NULL,
    ADD COLUMN `shippingTax` DECIMAL(12, 2) NULL,
    ADD COLUMN `subtotal` DECIMAL(12, 2) NULL,
    ADD COLUMN `totalAmount` DECIMAL(12, 2) NULL;

-- AlterTable
ALTER TABLE `PurchaseOrderItem` ADD COLUMN `taxAmount` DECIMAL(12, 2) NULL,
    ADD COLUMN `taxRate` DECIMAL(5, 2) NULL;

-- AlterTable
ALTER TABLE `Role` ALTER COLUMN `updatedAt` DROP DEFAULT;
