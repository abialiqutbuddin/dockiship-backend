-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tenant` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Tenant_slug_key`(`slug`),
    INDEX `Tenant_slug_idx`(`slug`),
    INDEX `Tenant_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserTenant` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `isOwner` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('invited', 'active', 'suspended') NOT NULL DEFAULT 'active',

    INDEX `UserTenant_tenantId_idx`(`tenantId`),
    INDEX `UserTenant_userId_idx`(`userId`),
    UNIQUE INDEX `UserTenant_userId_tenantId_key`(`userId`, `tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `tenantId` VARCHAR(191) NOT NULL,

    INDEX `Role_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `Role_name_tenantId_key`(`name`, `tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,

    UNIQUE INDEX `Permission_name_key`(`name`),
    INDEX `Permission_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `id` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,

    INDEX `RolePermission_roleId_idx`(`roleId`),
    INDEX `RolePermission_permissionId_idx`(`permissionId`),
    UNIQUE INDEX `RolePermission_roleId_permissionId_key`(`roleId`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserTenantRole` (
    `id` VARCHAR(191) NOT NULL,
    `userTenantId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,

    INDEX `UserTenantRole_userTenantId_idx`(`userTenantId`),
    INDEX `UserTenantRole_roleId_idx`(`roleId`),
    UNIQUE INDEX `UserTenantRole_userTenantId_roleId_key`(`userTenantId`, `roleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Plan` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `stripePrice` VARCHAR(191) NULL,
    `stripeProd` VARCHAR(191) NULL,

    UNIQUE INDEX `Plan_code_key`(`code`),
    INDEX `Plan_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Feature` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,

    UNIQUE INDEX `Feature_code_key`(`code`),
    INDEX `Feature_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlanFeature` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `featureId` VARCHAR(191) NOT NULL,
    `value` INTEGER NULL,

    INDEX `PlanFeature_planId_idx`(`planId`),
    INDEX `PlanFeature_featureId_idx`(`featureId`),
    UNIQUE INDEX `PlanFeature_planId_featureId_key`(`planId`, `featureId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NULL,
    `status` ENUM('trialing', 'active', 'past_due', 'canceled') NOT NULL DEFAULT 'trialing',
    `currentPeriodEnd` DATETIME(3) NULL,
    `stripeCustomerId` VARCHAR(191) NULL,
    `stripeSubId` VARCHAR(191) NULL,

    UNIQUE INDEX `Subscription_tenantId_key`(`tenantId`),
    INDEX `Subscription_planId_idx`(`planId`),
    INDEX `Subscription_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TenantEntitlement` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `featureId` VARCHAR(191) NOT NULL,
    `value` INTEGER NULL,

    INDEX `TenantEntitlement_tenantId_idx`(`tenantId`),
    INDEX `TenantEntitlement_featureId_idx`(`featureId`),
    UNIQUE INDEX `TenantEntitlement_tenantId_featureId_key`(`tenantId`, `featureId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserTenant` ADD CONSTRAINT `UserTenant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserTenant` ADD CONSTRAINT `UserTenant_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Role` ADD CONSTRAINT `Role_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserTenantRole` ADD CONSTRAINT `UserTenantRole_userTenantId_fkey` FOREIGN KEY (`userTenantId`) REFERENCES `UserTenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserTenantRole` ADD CONSTRAINT `UserTenantRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanFeature` ADD CONSTRAINT `PlanFeature_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanFeature` ADD CONSTRAINT `PlanFeature_featureId_fkey` FOREIGN KEY (`featureId`) REFERENCES `Feature`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TenantEntitlement` ADD CONSTRAINT `TenantEntitlement_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TenantEntitlement` ADD CONSTRAINT `TenantEntitlement_featureId_fkey` FOREIGN KEY (`featureId`) REFERENCES `Feature`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
