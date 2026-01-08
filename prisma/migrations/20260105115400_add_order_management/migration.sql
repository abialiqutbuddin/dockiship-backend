-- CreateTable
CREATE TABLE `Color` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    INDEX `Color_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `Color_tenantId_name_key`(`tenantId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `orderId` VARCHAR(191) NULL,
    `sellingMediumId` VARCHAR(191) NULL,
    `courierMediumId` VARCHAR(191) NULL,
    `productDescription` VARCHAR(191) NULL,
    `sizeId` VARCHAR(191) NULL,
    `colorId` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `costPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalCost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `otherFee` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `netProfit` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `trackingId` VARCHAR(191) NULL,
    `status` ENUM('LABEL_PRINTED', 'PACKED', 'SHIPPED', 'DROP_OFF', 'DELIVERED', 'RETURN', 'CANCEL', 'REFUND') NOT NULL DEFAULT 'LABEL_PRINTED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Order_tenantId_idx`(`tenantId`),
    INDEX `Order_status_idx`(`status`),
    INDEX `Order_orderId_idx`(`orderId`),
    INDEX `Order_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Color` ADD CONSTRAINT `Color_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_sellingMediumId_fkey` FOREIGN KEY (`sellingMediumId`) REFERENCES `SellingMedium`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_courierMediumId_fkey` FOREIGN KEY (`courierMediumId`) REFERENCES `CourierMedium`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_sizeId_fkey` FOREIGN KEY (`sizeId`) REFERENCES `Size`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_colorId_fkey` FOREIGN KEY (`colorId`) REFERENCES `Color`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
