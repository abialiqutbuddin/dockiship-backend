-- AlterTable
ALTER TABLE `Role` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `Supplier` ADD COLUMN `contacts` VARCHAR(191) NULL;
