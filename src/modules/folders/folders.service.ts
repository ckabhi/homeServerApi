import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { RenameFolderDto } from './dto/rename-folder.dto';
import {
  FolderNotFoundError,
  FolderAlreadyExistsError,
  InvalidFolderPathError,
} from '../files/exceptions/file-errors';
import { PathResolverHelper } from '../files/helpers/path-resolver.helper';

@Injectable()
export class FoldersService {
  constructor(private readonly prisma: PrismaService) {}

  async createFolder(userId: string, dto: CreateFolderDto) {
    const folderName = PathResolverHelper.sanitizeFolderName(dto.folderName);
    if (!folderName) {
      throw new InvalidFolderPathError('Invalid folder name');
    }

    let parentPath = '';
    if (dto.parentFolderId) {
      const parent = await this.prisma.folderPermission.findUnique({
        where: { id: dto.parentFolderId },
      });
      if (!parent || parent.userId !== userId || parent.isShared || parent.isDeleted) {
        throw new FolderNotFoundError('Parent folder not found');
      }
      parentPath = parent.folderPath;
    }

    const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;
    PathResolverHelper.validateFolderPath(folderPath);

    const existing = await this.prisma.folderPermission.findFirst({
      where: { userId, folderPath, isShared: false, isDeleted: false },
    });
    if (existing) {
      throw new FolderAlreadyExistsError();
    }

    const folder = await this.prisma.folderPermission.create({
      data: {
        userId,
        folderName,
        folderPath,
        parentPath,
        parentFolderId: dto.parentFolderId,
        isShared: false,
      },
    });

    return {
      folderId: folder.id,
      folderName: folder.folderName,
      folderPath: folder.folderPath,
      createdAt: folder.createdAt,
    };
  }

  async deleteFolder(userId: string, folderId: string, force: boolean = false) {
    const folder = await this.prisma.folderPermission.findUnique({ where: { id: folderId } });

    if (!folder || folder.userId !== userId || folder.isShared || folder.isDeleted) {
      throw new FolderNotFoundError('Folder not found');
    }

    const childFolders = await this.prisma.folderPermission.count({
      where: {
        userId,
        isShared: false,
        isDeleted: false,
        folderPath: { startsWith: `${folder.folderPath}/` },
      },
    });

    const files = await this.prisma.fileMetadata.count({
      where: {
        userId,
        isSharedFile: false,
        isDeleted: false,
        folderPath: { startsWith: folder.folderPath },
      },
    });

    if (!force && (childFolders > 0 || files > 0)) {
      throw new InvalidFolderPathError(
        'Folder not empty. Use force=true to delete with contents.',
      );
    }

    if (force) {
      await this.prisma.folderPermission.updateMany({
        where: {
          userId,
          isShared: false,
          isDeleted: false,
          folderPath: { startsWith: folder.folderPath },
        },
        data: { isDeleted: true, updatedAt: new Date() },
      });

      await this.prisma.fileMetadata.updateMany({
        where: {
          userId,
          isSharedFile: false,
          isDeleted: false,
          folderPath: { startsWith: folder.folderPath },
        },
        data: { isDeleted: true, updatedAt: new Date() },
      });
    }

    await this.prisma.folderPermission.update({
      where: { id: folder.id },
      data: { isDeleted: true, updatedAt: new Date() },
    });

    return {
      message: 'Folder deleted successfully',
      deletedFolders: childFolders,
      deletedFiles: files,
    };
  }

  async renameFolder(userId: string, folderId: string, dto: RenameFolderDto) {
    const folder = await this.prisma.folderPermission.findUnique({ where: { id: folderId } });

    if (!folder || folder.userId !== userId || folder.isShared || folder.isDeleted) {
      throw new FolderNotFoundError('Folder not found');
    }

    const folderName = PathResolverHelper.sanitizeFolderName(dto.newFolderName);
    if (!folderName) {
      throw new InvalidFolderPathError('Invalid folder name');
    }

    const newFolderPath = folder.parentPath
      ? `${folder.parentPath}/${folderName}`
      : folderName;

    const existing = await this.prisma.folderPermission.findFirst({
      where: { userId, folderPath: newFolderPath, isShared: false, isDeleted: false },
    });
    if (existing) {
      throw new FolderAlreadyExistsError('New folder name already exists');
    }

    const updated = await this.prisma.folderPermission.update({
      where: { id: folder.id },
      data: {
        folderName,
        folderPath: newFolderPath,
        updatedAt: new Date(),
      },
    });

    const nestedFolders = await this.prisma.folderPermission.findMany({
      where: {
        userId,
        isShared: false,
        isDeleted: false,
        folderPath: { startsWith: `${folder.folderPath}/` },
      },
    });

    for (const nested of nestedFolders) {
      const relativePath = nested.folderPath.slice(folder.folderPath.length + 1);
      const nestedParentPath = nested.parentPath.startsWith(folder.folderPath)
        ? nested.parentPath.replace(folder.folderPath, newFolderPath)
        : nested.parentPath;

      await this.prisma.folderPermission.update({
        where: { id: nested.id },
        data: {
          folderPath: `${newFolderPath}/${relativePath}`,
          parentPath: nestedParentPath,
          updatedAt: new Date(),
        },
      });
    }

    await this.prisma.fileMetadata.updateMany({
      where: {
        userId,
        isSharedFile: false,
        isDeleted: false,
        folderPath: { startsWith: folder.folderPath },
      },
      data: { updatedAt: new Date() },
    });

    return {
      folderId: updated.id,
      oldFolderPath: folder.folderPath,
      newFolderPath: updated.folderPath,
      renamedAt: updated.updatedAt,
      filesUpdated: nestedFolders.length,
    };
  }
}
