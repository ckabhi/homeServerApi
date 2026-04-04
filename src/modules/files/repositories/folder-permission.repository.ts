import { FolderPermission, Prisma } from '@prisma/client';

export type CreateFolderInput = Prisma.FolderPermissionCreateInput;
export type UpdateFolderInput = Prisma.FolderPermissionUpdateInput;

/**
 * Contract for folder hierarchy persistence operations.
 */
export interface IFolderPermissionRepository {
  create(data: CreateFolderInput): Promise<FolderPermission>;
  findById(id: string): Promise<FolderPermission | null>;
  findByPath(
    userId: string,
    folderPath: string,
    isShared?: boolean,
  ): Promise<FolderPermission | null>;
  findByParentId(parentId: string): Promise<FolderPermission[]>;
  findAllByUserId(userId: string): Promise<FolderPermission[]>;
  findAllShared(folderPath?: string): Promise<FolderPermission[]>;
  update(id: string, data: UpdateFolderInput): Promise<FolderPermission>;
  softDelete(id: string): Promise<FolderPermission>;
  softDeleteChildren(parentId: string): Promise<number>;
}
