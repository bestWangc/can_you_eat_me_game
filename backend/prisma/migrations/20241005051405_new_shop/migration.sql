/*
  Warnings:

  - The `update_time` column on the `knapsack` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `update_time` column on the `shop` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `fragments` to the `shop` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fruit_name` to the `shop` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `knapsack` DROP COLUMN `update_time`,
    ADD COLUMN `update_time` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `shop` ADD COLUMN `fragments` INTEGER NOT NULL,
    ADD COLUMN `fruit_name` VARCHAR(255) NOT NULL,
    DROP COLUMN `update_time`,
    ADD COLUMN `update_time` DATETIME(3) NULL;
