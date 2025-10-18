/*
  Warnings:

  - You are about to drop the column `country` on the `UserTenant` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `UserTenant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Role` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `country` VARCHAR(2) NULL,
    ADD COLUMN `phone` VARCHAR(30) NULL;

-- AlterTable
ALTER TABLE `UserTenant` DROP COLUMN `country`,
    DROP COLUMN `phone`;
