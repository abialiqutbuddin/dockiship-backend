-- AlterTable
ALTER TABLE `Role` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `UserTenant` ADD COLUMN `acceptedAt` DATETIME(3) NULL,
    ADD COLUMN `invitedAt` DATETIME(3) NULL,
    MODIFY `status` ENUM('invited', 'active', 'suspended') NOT NULL DEFAULT 'invited';
