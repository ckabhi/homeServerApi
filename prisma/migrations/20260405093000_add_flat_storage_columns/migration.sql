-- Add flat-storage naming columns to file metadata
ALTER TABLE `file_metadata`
  ADD COLUMN `displayName` VARCHAR(191) NULL,
  ADD COLUMN `systemFileName` VARCHAR(191) NULL;

-- Track resolved names in upload sessions for complete-upload integrity
ALTER TABLE `file_upload_sessions`
  ADD COLUMN `displayName` VARCHAR(191) NULL,
  ADD COLUMN `systemFileName` VARCHAR(191) NULL,
  ADD COLUMN `folderPath` VARCHAR(191) NULL,
  ADD COLUMN `parentFolderId` VARCHAR(191) NULL,
  ADD COLUMN `isSharedFile` BOOLEAN NOT NULL DEFAULT false;

-- Backfill display names from legacy fileName
UPDATE `file_metadata`
SET `displayName` = `fileName`
WHERE `displayName` IS NULL;

-- Generate UUID-based system filenames preserving extension
UPDATE `file_metadata`
SET `systemFileName` = CONCAT(
  REPLACE(UUID(), '-', ''),
  CASE
    WHEN INSTR(`fileName`, '.') > 0 THEN CONCAT('.', SUBSTRING_INDEX(`fileName`, '.', -1))
    ELSE ''
  END
)
WHERE `systemFileName` IS NULL;

-- Make new fields required after backfill
ALTER TABLE `file_metadata`
  MODIFY `displayName` VARCHAR(191) NOT NULL,
  MODIFY `systemFileName` VARCHAR(191) NOT NULL;

-- Replace old indexes with new access patterns
DROP INDEX `file_metadata_userId_folderPath_idx` ON `file_metadata`;
DROP INDEX `file_metadata_isSharedFile_idx` ON `file_metadata`;
DROP INDEX `file_metadata_parentFolderId_idx` ON `file_metadata`;

CREATE INDEX `file_metadata_userId_parentFolderId_idx`
  ON `file_metadata`(`userId`, `parentFolderId`);
CREATE INDEX `file_metadata_userId_isSharedFile_idx`
  ON `file_metadata`(`userId`, `isSharedFile`);
CREATE INDEX `file_metadata_isSharedFile_parentFolderId_idx`
  ON `file_metadata`(`isSharedFile`, `parentFolderId`);
CREATE INDEX `file_metadata_displayName_idx`
  ON `file_metadata`(`displayName`);

-- Ensure storage name uniqueness across all files
CREATE UNIQUE INDEX `file_metadata_systemFileName_key`
  ON `file_metadata`(`systemFileName`);
