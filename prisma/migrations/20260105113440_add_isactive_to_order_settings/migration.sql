-- AlterTable
ALTER TABLE `CourierMedium` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `RemarkType` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `SellingMedium` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX `CourierMedium_isActive_idx` ON `CourierMedium`(`isActive`);

-- CreateIndex
CREATE INDEX `RemarkType_isActive_idx` ON `RemarkType`(`isActive`);

-- CreateIndex
CREATE INDEX `SellingMedium_isActive_idx` ON `SellingMedium`(`isActive`);
