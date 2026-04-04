import { FileMetadata, Prisma } from '@prisma/client';

export type CreateFileMetadataInput = Prisma.FileMetadataCreateInput;
export type UpdateFileMetadataInput = Prisma.FileMetadataUpdateInput;

/**
 * Contract for file metadata persistence operations.
 */
export interface IFileMetadataRepository {
  create(data: CreateFileMetadataInput): Promise<FileMetadata>;
  findById(id: string): Promise<FileMetadata | null>;
  findByObjectKey(objectKey: string): Promise<FileMetadata | null>;
  findByFolderPath(userId: string, folderPath: string): Promise<FileMetadata[]>;
  findAllByUserId(userId: string): Promise<FileMetadata[]>;
  findAllShared(folderPath?: string): Promise<FileMetadata[]>;
  update(id: string, data: UpdateFileMetadataInput): Promise<FileMetadata>;
  softDelete(id: string): Promise<FileMetadata>;
  softDeleteByFolderPath(folderPath: string): Promise<number>;
}
