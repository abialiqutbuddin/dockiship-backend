-- AlterTable
ALTER TABLE `ProductVariant` ADD COLUMN `colorText` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Role` ALTER COLUMN `updatedAt` DROP DEFAULT;
