-- AlterTable
ALTER TABLE `sessions` ADD COLUMN `sessionId` VARCHAR(191) NULL;

-- fill the sessionid with the id
UPDATE `sessions` SET `sessionId` = `id`;

-- make the sessionid not null
ALTER TABLE `sessions` MODIFY `sessionId` VARCHAR(191) NOT NULL;
