-- AlterTable
ALTER TABLE `ProductVariant` ADD COLUMN `packagingQuantity` INTEGER NULL,
    ADD COLUMN `packagingType` ENUM('PAIR', 'UNITS', 'PIECES_PER_PACK') NULL;

-- AlterTable
ALTER TABLE `Role` ALTER COLUMN `updatedAt` DROP DEFAULT;
