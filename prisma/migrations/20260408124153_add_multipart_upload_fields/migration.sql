-- DropIndex
DROP INDEX `file_metadata_systemFileName_key` ON `file_metadata`;

-- AlterTable
ALTER TABLE `file_upload_sessions` ADD COLUMN `chunkSize` INTEGER NULL,
    ADD COLUMN `isMultipart` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `totalChunks` INTEGER NULL,
    ADD COLUMN `uploadId` VARCHAR(191) NULL;

-- RenameIndex
ALTER TABLE `file_upload_sessions` RENAME INDEX `file_upload_sessions_userId_fkey` TO `file_upload_sessions_userId_idx`;
