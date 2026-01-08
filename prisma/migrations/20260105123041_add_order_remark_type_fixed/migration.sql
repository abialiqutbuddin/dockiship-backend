-- AlterTable
ALTER TABLE `Order` ADD COLUMN `remarkTypeId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_remarkTypeId_fkey` FOREIGN KEY (`remarkTypeId`) REFERENCES `RemarkType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
