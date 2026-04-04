-- Drop existing cross-module foreign keys to users (module decoupling)
ALTER TABLE `file_upload_sessions` DROP FOREIGN KEY `file_upload_sessions_userId_fkey`;
ALTER TABLE `file_metadata` DROP FOREIGN KEY `file_metadata_userId_fkey`;
ALTER TABLE `folder_permissions` DROP FOREIGN KEY `folder_permissions_userId_fkey`;
ALTER TABLE `file_chunk_uploads` DROP FOREIGN KEY `file_chunk_uploads_userId_fkey`;
ALTER TABLE `file_audit_logs` DROP FOREIGN KEY `file_audit_logs_userId_fkey`;

-- File metadata hierarchy and shared support
ALTER TABLE `file_metadata`
  ADD COLUMN `parentFolderId` VARCHAR(191) NULL,
  ADD COLUMN `isSharedFile` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `file_metadata_isSharedFile_idx` ON `file_metadata`(`isSharedFile`);
CREATE INDEX `file_metadata_parentFolderId_idx` ON `file_metadata`(`parentFolderId`);

-- Folder hierarchy and shared support
ALTER TABLE `folder_permissions`
  ADD COLUMN `parentFolderId` VARCHAR(191) NULL,
  ADD COLUMN `isShared` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `folder_permissions` DROP INDEX `folder_permissions_userId_folderPath_key`;
CREATE UNIQUE INDEX `folder_permissions_userId_folderPath_isShared_key`
  ON `folder_permissions`(`userId`, `folderPath`, `isShared`);

CREATE INDEX `folder_permissions_userId_idx` ON `folder_permissions`(`userId`);
CREATE INDEX `folder_permissions_parentFolderId_idx` ON `folder_permissions`(`parentFolderId`);
CREATE INDEX `folder_permissions_isShared_idx` ON `folder_permissions`(`isShared`);

ALTER TABLE `folder_permissions`
  ADD CONSTRAINT `folder_permissions_parentFolderId_fkey`
  FOREIGN KEY (`parentFolderId`) REFERENCES `folder_permissions`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Audit log index optimization
DROP INDEX `file_audit_logs_userId_operation_idx` ON `file_audit_logs`;
CREATE INDEX `file_audit_logs_userId_operation_createdAt_idx`
  ON `file_audit_logs`(`userId`, `operation`, `createdAt`);
