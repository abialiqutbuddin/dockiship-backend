-- AlterTable
ALTER TABLE `ChannelListing` MODIFY `externalSku` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Role` ALTER COLUMN `updatedAt` DROP DEFAULT;
