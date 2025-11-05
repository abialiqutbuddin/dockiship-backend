-- AlterTable
ALTER TABLE `Role` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- CreateTable
CREATE TABLE `TenantChannel` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NULL,
    `storeUrl` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `credentials` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TenantChannel_tenantId_idx`(`tenantId`),
    INDEX `TenantChannel_provider_idx`(`provider`),
    UNIQUE INDEX `TenantChannel_tenantId_provider_name_key`(`tenantId`, `provider`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChannelListing` (
    `id` VARCHAR(191) NOT NULL,
    `tenantChannelId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `productVariantId` VARCHAR(191) NULL,
    `externalSku` VARCHAR(191) NOT NULL,
    `externalListingId` VARCHAR(191) NULL,
    `url` VARCHAR(191) NULL,
    `title` VARCHAR(191) NULL,
    `price` DECIMAL(12, 2) NULL,
    `currency` VARCHAR(3) NULL,
    `units` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ChannelListing_tenantChannelId_idx`(`tenantChannelId`),
    INDEX `ChannelListing_productId_idx`(`productId`),
    INDEX `ChannelListing_productVariantId_idx`(`productVariantId`),
    INDEX `ChannelListing_status_idx`(`status`),
    UNIQUE INDEX `ChannelListing_tenantChannelId_externalSku_key`(`tenantChannelId`, `externalSku`),
    UNIQUE INDEX `ChannelListing_tenantChannelId_productId_key`(`tenantChannelId`, `productId`),
    UNIQUE INDEX `ChannelListing_tenantChannelId_productVariantId_key`(`tenantChannelId`, `productVariantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TenantChannel` ADD CONSTRAINT `TenantChannel_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChannelListing` ADD CONSTRAINT `ChannelListing_tenantChannelId_fkey` FOREIGN KEY (`tenantChannelId`) REFERENCES `TenantChannel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChannelListing` ADD CONSTRAINT `ChannelListing_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChannelListing` ADD CONSTRAINT `ChannelListing_productVariantId_fkey` FOREIGN KEY (`productVariantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
