/*
  Warnings:

  - Made the column `sessionId` on table `sessions` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `sessions` MODIFY `sessionId` VARCHAR(191) NOT NULL;
