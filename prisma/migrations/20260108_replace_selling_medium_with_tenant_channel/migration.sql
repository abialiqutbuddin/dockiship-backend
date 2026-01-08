-- Custom Migration: Replace SellingMedium with TenantChannel for Orders (MySQL)
-- This migration performs the data migration before dropping the old table
-- Note: TenantChannel.marketplace is mapped to column `name` in the database

-- Step 1: Add new tenantChannelId column to Order table (skip if exists from partial migration)
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'Order' 
               AND COLUMN_NAME = 'tenantChannelId');
SET @query := IF(@exist = 0, 'ALTER TABLE `Order` ADD COLUMN `tenantChannelId` VARCHAR(191) NULL', 'SELECT 1');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: Create TenantChannel records for each unique SellingMedium
-- Only if the SellingMedium doesn't already have a matching TenantChannel
-- Note: TenantChannel uses `name` column (mapped from Prisma's `marketplace` field)
INSERT INTO `TenantChannel` (`id`, `tenantId`, `name`, `provider`, `isActive`, `createdAt`, `updatedAt`)
SELECT 
    UUID(),
    sm.`tenantId`,
    sm.`name`,
    NULL,
    sm.`isActive`,
    NOW(),
    NOW()
FROM `SellingMedium` sm
WHERE NOT EXISTS (
    SELECT 1 FROM `TenantChannel` tc 
    WHERE tc.`tenantId` = sm.`tenantId` 
    AND tc.`name` = sm.`name`
    AND tc.`provider` IS NULL
);

-- Step 3: Update Order records to point to the corresponding TenantChannel
-- Match by tenant and name
UPDATE `Order` o
INNER JOIN `SellingMedium` sm ON o.`sellingMediumId` = sm.`id`
INNER JOIN `TenantChannel` tc ON tc.`tenantId` = sm.`tenantId` AND tc.`name` = sm.`name` AND tc.`provider` IS NULL
SET o.`tenantChannelId` = tc.`id`;

-- Step 4: Drop the sellingMediumId foreign key constraint (ignore if doesn't exist)
SET @fk_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
                   WHERE CONSTRAINT_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'Order' 
                   AND CONSTRAINT_NAME = 'Order_sellingMediumId_fkey');
SET @drop_fk := IF(@fk_exists > 0, 'ALTER TABLE `Order` DROP FOREIGN KEY `Order_sellingMediumId_fkey`', 'SELECT 1');
PREPARE stmt FROM @drop_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 5: Drop the sellingMediumId column (ignore if doesn't exist)
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'Order' 
                    AND COLUMN_NAME = 'sellingMediumId');
SET @drop_col := IF(@col_exists > 0, 'ALTER TABLE `Order` DROP COLUMN `sellingMediumId`', 'SELECT 1');
PREPARE stmt FROM @drop_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 6: Add foreign key constraint for tenantChannelId (skip if exists)
SET @fk_new_exists := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
                       WHERE CONSTRAINT_SCHEMA = DATABASE() 
                       AND TABLE_NAME = 'Order' 
                       AND CONSTRAINT_NAME = 'Order_tenantChannelId_fkey');
SET @add_fk := IF(@fk_new_exists = 0, 'ALTER TABLE `Order` ADD CONSTRAINT `Order_tenantChannelId_fkey` FOREIGN KEY (`tenantChannelId`) REFERENCES `TenantChannel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE stmt FROM @add_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 7: Create index on tenantChannelId (skip if exists)
SET @idx_exists := (SELECT COUNT(*) FROM information_schema.STATISTICS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'Order' 
                    AND INDEX_NAME = 'Order_tenantChannelId_idx');
SET @add_idx := IF(@idx_exists = 0, 'CREATE INDEX `Order_tenantChannelId_idx` ON `Order`(`tenantChannelId`)', 'SELECT 1');
PREPARE stmt FROM @add_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 8: Drop the SellingMedium table (skip if doesn't exist)
DROP TABLE IF EXISTS `SellingMedium`;
