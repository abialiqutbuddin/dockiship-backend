/*
  Warnings:

  - You are about to drop the column `condition` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `dimensionUnit` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `height` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `length` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `originalCurrency` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `originalPrice` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `retailCurrency` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `retailPrice` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `weight` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `weightUnit` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `width` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Product` DROP COLUMN `condition`,
    DROP COLUMN `dimensionUnit`,
    DROP COLUMN `height`,
    DROP COLUMN `length`,
    DROP COLUMN `originalCurrency`,
    DROP COLUMN `originalPrice`,
    DROP COLUMN `retailCurrency`,
    DROP COLUMN `retailPrice`,
    DROP COLUMN `weight`,
    DROP COLUMN `weightUnit`,
    DROP COLUMN `width`;

-- AlterTable
ALTER TABLE `ProductVariant` ADD COLUMN `originalCurrency` VARCHAR(3) NULL,
    ADD COLUMN `originalPrice` DECIMAL(12, 2) NULL,
    ADD COLUMN `retailCurrency` VARCHAR(3) NULL,
    ADD COLUMN `retailPrice` DECIMAL(12, 2) NULL,
    ADD COLUMN `stockInTransit` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `stockOnHand` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `stockReserved` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Role` ALTER COLUMN `updatedAt` DROP DEFAULT;
