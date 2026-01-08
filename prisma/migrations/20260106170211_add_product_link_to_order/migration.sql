-- AlterTable
ALTER TABLE `Order` ADD COLUMN `productId` VARCHAR(191) NULL,
    ADD COLUMN `productVariantId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Order_productId_idx` ON `Order`(`productId`);

-- CreateIndex
CREATE INDEX `Order_productVariantId_idx` ON `Order`(`productVariantId`);

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_productVariantId_fkey` FOREIGN KEY (`productVariantId`) REFERENCES `ProductVariant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
