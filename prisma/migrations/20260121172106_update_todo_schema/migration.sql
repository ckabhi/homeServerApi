/*
  Warnings:

  - You are about to drop the column `dueDate` on the `todos` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `todos` DROP COLUMN `dueDate`,
    ADD COLUMN `color` VARCHAR(191) NULL,
    ADD COLUMN `endDate` DATETIME(3) NULL,
    ADD COLUMN `isImportant` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isRecurring` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `parentId` VARCHAR(191) NULL,
    ADD COLUMN `recurrencePattern` VARCHAR(191) NULL,
    ADD COLUMN `startDate` DATETIME(3) NULL,
    ADD COLUMN `tags` JSON NULL,
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'new';
