import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../../authentication/auth.service';
import { CreateFolderDto } from '../dto/create-folder.dto';
import {
  FolderNotFoundError,
  UnauthorizedAccessError,
  InvalidFolderPathError,
} from '../exceptions/file-errors';
import { PathResolverHelper } from '../helpers/path-resolver.helper';

@Injectable()
export class FolderService {
  private readonly logger = new Logger(FolderService.name);

  private buildFolderTree(
    items: Array<{
      id: string;
      folderName: string;
      folderPath: string;
      parentFolderId: string | null;
    }>,
    parentId?: string | null,
  ): Array<{
    id: string;
    folderName: string;
    folderPath: string;
    depth: number;
    children: Array<{
      id: string;
      folderName: string;
      folderPath: string;
      depth: number;
      children: unknown[];
    }>;
  }> {
    return items
      .filter((item) =>
        parentId === undefined
          ? item.parentFolderId === null
          : item.parentFolderId === parentId,
      )
      .map((item) => ({
        id: item.id,
        folderName: item.folderName,
        folderPath: item.folderPath,
        depth: PathResolverHelper.getFolderDepth(item.folderPath),
        children: this.buildFolderTree(items, item.id),
      }));
  }

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  /**
   * Validate user exists
   */
  private async validateUserExists(userId: string): Promise<void> {
    const userExists = await this.authService.validateUser(userId);
    if (!userExists) {
      throw new UnauthorizedAccessError('User not found or deleted');
    }
  }

  /**
   * Create a new folder with hierarchy support
   */
  async createFolder(
    userId: string,
    dto: CreateFolderDto,
    parentFolderId?: string,
  ) {
    const resolvedParentFolderId = parentFolderId || dto.parentFolderId;

    // Step 1: Validate user
    await this.validateUserExists(userId);

    // Step 2: Validate folder name
    const sanitizedName = PathResolverHelper.sanitizeFolderName(dto.folderName);
    if (!sanitizedName) {
      throw new InvalidFolderPathError(
        'Folder name is invalid after sanitization',
      );
    }

    // Step 3: Validate parent folder if provided
    let parentFolder: {
      userId: string;
      folderPath: string;
      isDeleted: boolean;
    } | null = null;
    if (resolvedParentFolderId) {
      parentFolder = await this.prisma.folderPermission.findUnique({
        where: { id: resolvedParentFolderId },
        select: {
          userId: true,
          folderPath: true,
          isDeleted: true,
        },
      });
      if (
        !parentFolder ||
        parentFolder.userId !== userId ||
        parentFolder.isDeleted
      ) {
        throw new FolderNotFoundError(
          'Parent folder not found or not authorized',
        );
      }
    }

    // Step 4: Calculate folder path
    const folderPath = parentFolder
      ? `${parentFolder.folderPath}/${sanitizedName}`
      : sanitizedName;

    // Step 5: Check uniqueness
    const existing = await this.prisma.folderPermission.findFirst({
      where: {
        userId,
        folderPath,
        isShared: dto.isShared || false,
        isDeleted: false,
      },
    });

    if (existing) {
      throw new InvalidFolderPathError('Folder already exists at this path');
    }

    // Step 6: Create folder
    const folder = await this.prisma.folderPermission.create({
      data: {
        userId,
        folderName: sanitizedName,
        folderPath,
        parentPath: parentFolder?.folderPath || '',
        parentFolderId: resolvedParentFolderId,
        isShared: dto.isShared || false,
      },
    });

    // Step 7: Log audit entry
    await this.prisma.fileAuditLog.create({
      data: {
        userId,
        operation: 'CREATE_FOLDER',
        objectKey: folderPath,
        status: 'SUCCESS',
        details: `Folder created: ${folderPath}`,
      },
    });

    this.logger.log(`Folder created: ${folderPath} for user ${userId}`);

    return {
      id: folder.id,
      folderName: folder.folderName,
      folderPath: folder.folderPath,
      createdAt: folder.createdAt,
    };
  }

  /**
   * Rename a folder and cascade update all nested items
   */
  async renameFolder(userId: string, folderId: string, newName: string) {
    // Step 1: Validate user
    await this.validateUserExists(userId);

    // Step 2: Find folder
    const folder = await this.prisma.folderPermission.findUnique({
      where: { id: folderId },
    });

    if (!folder || folder.userId !== userId || folder.isDeleted) {
      throw new FolderNotFoundError('Folder not found or not authorized');
    }

    // Step 3: Validate new name
    const sanitizedName = PathResolverHelper.sanitizeFolderName(newName);
    if (!sanitizedName) {
      throw new InvalidFolderPathError('Folder name is invalid');
    }

    // Step 4: Build new path
    const parentPath = folder.folderPath.substring(
      0,
      folder.folderPath.lastIndexOf('/'),
    );
    const newFolderPath = parentPath
      ? `${parentPath}/${sanitizedName}`
      : sanitizedName;

    // Step 5: Update folder
    const updated = await this.prisma.folderPermission.update({
      where: { id: folderId },
      data: {
        folderName: sanitizedName,
        folderPath: newFolderPath,
        updatedAt: new Date(),
      },
    });

    // Step 6: Update all nested folders
    const nestedFolders = await this.prisma.folderPermission.findMany({
      where: {
        userId,
        folderPath: {
          startsWith: folder.folderPath + '/',
        },
      },
    });

    for (const nested of nestedFolders) {
      const relativePath = nested.folderPath.substring(
        folder.folderPath.length + 1,
      );
      const newNestedPath = `${newFolderPath}/${relativePath}`;

      await this.prisma.folderPermission.update({
        where: { id: nested.id },
        data: {
          folderPath: newNestedPath,
          parentPath: newFolderPath,
          updatedAt: new Date(),
        },
      });
    }

    // Step 7: Update all files in this folder and nested folders
    await this.prisma.fileMetadata.updateMany({
      where: {
        userId,
        folderPath: {
          startsWith: folder.folderPath,
        },
      },
      data: {
        updatedAt: new Date(),
      },
    });

    // Step 8: Log audit entry
    await this.prisma.fileAuditLog.create({
      data: {
        userId,
        operation: 'RENAME',
        objectKey: newFolderPath,
        status: 'SUCCESS',
        details: `Folder renamed from ${folder.folderPath} to ${newFolderPath}`,
      },
    });

    return {
      id: updated.id,
      oldFolderPath: folder.folderPath,
      newFolderPath: updated.folderPath,
      renamedAt: updated.updatedAt,
      updatedItemsCount: nestedFolders.length,
    };
  }

  /**
   * Delete a folder
   */
  async deleteFolder(userId: string, folderId: string, force: boolean = false) {
    // Step 1: Validate user
    await this.validateUserExists(userId);

    // Step 2: Find folder
    const folder = await this.prisma.folderPermission.findUnique({
      where: { id: folderId },
    });

    if (!folder || folder.userId !== userId || folder.isDeleted) {
      throw new FolderNotFoundError('Folder not found or not authorized');
    }

    // Step 3: Check if folder has children/files
    const childFolders = await this.prisma.folderPermission.count({
      where: {
        userId,
        folderPath: {
          startsWith: folder.folderPath + '/',
        },
        isDeleted: false,
      },
    });

    const files = await this.prisma.fileMetadata.count({
      where: {
        userId,
        folderPath: {
          startsWith: folder.folderPath,
        },
        isDeleted: false,
      },
    });

    // If has children and not force, throw error
    if ((childFolders > 0 || files > 0) && !force) {
      throw new InvalidFolderPathError(
        'Folder not empty. Use force=true to delete with contents.',
      );
    }

    // Step 4: If force, cascade soft delete
    if (force && (childFolders > 0 || files > 0)) {
      // Delete nested folders
      await this.prisma.folderPermission.updateMany({
        where: {
          userId,
          folderPath: {
            startsWith: folder.folderPath,
          },
        },
        data: {
          isDeleted: true,
          updatedAt: new Date(),
        },
      });

      // Delete files in folder
      await this.prisma.fileMetadata.updateMany({
        where: {
          userId,
          folderPath: {
            startsWith: folder.folderPath,
          },
        },
        data: {
          isDeleted: true,
          updatedAt: new Date(),
        },
      });
    }

    // Step 5: Delete the folder itself
    await this.prisma.folderPermission.update({
      where: { id: folderId },
      data: {
        isDeleted: true,
        updatedAt: new Date(),
      },
    });

    // Step 6: Log audit entry
    await this.prisma.fileAuditLog.create({
      data: {
        userId,
        operation: 'DELETE',
        objectKey: folder.folderPath,
        status: 'SUCCESS',
        details: `Folder deleted: ${folder.folderPath} (force=${force})`,
      },
    });

    return {
      message: 'Folder deleted successfully',
      deletedFolders: childFolders,
      deletedFiles: files,
    };
  }

  /**
   * List all subfolders for a user
   */
  async listSubfolders(userId: string, parentFolderId?: string) {
    // Validate user
    await this.validateUserExists(userId);

    const queryWhere: Prisma.FolderPermissionWhereInput = {
      userId,
      isDeleted: false,
      isShared: false,
      parentFolderId: parentFolderId ?? null,
    };

    const folders = await this.prisma.folderPermission.findMany({
      where: queryWhere,
      select: {
        id: true,
        folderName: true,
        folderPath: true,
        parentFolderId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { folderName: 'asc' },
    });

    return folders;
  }

  /**
   * Get complete folder hierarchy for user
   */
  async getFolderHierarchy(userId: string) {
    // Validate user
    await this.validateUserExists(userId);

    const folders = await this.prisma.folderPermission.findMany({
      where: {
        userId,
        isShared: false,
        isDeleted: false,
      },
      select: {
        id: true,
        folderName: true,
        folderPath: true,
        parentFolderId: true,
      },
      orderBy: { folderPath: 'asc' },
    });

    return this.buildFolderTree(folders);
  }

  /**
   * Validate folder ownership
   */
  async validateFolderOwnership(
    userId: string,
    folderId: string,
  ): Promise<boolean> {
    const folder = await this.prisma.folderPermission.findUnique({
      where: { id: folderId },
    });

    return folder?.userId === userId && !folder?.isDeleted;
  }
}
