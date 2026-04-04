import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { MinioService } from './minio.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../authentication/auth.service';
import { GenerateUploadUrlDto } from './dto/generate-upload-url.dto';
import { GenerateDownloadUrlDto } from './dto/generate-download-url.dto';
import { ListFolderContentsDto } from './dto/list-folder-contents.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { v7 as uuidv7 } from 'uuid';
import {
  FileNotFoundError,
  UnauthorizedAccessError,
  FolderNotFoundError,
} from './exceptions/file-errors';
import { PathResolverHelper } from './helpers/path-resolver.helper';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly minioService: MinioService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  /**
   * Validate user exists and is not deleted
   */
  private async validateUserExists(userId: string): Promise<void> {
    const userExists = await this.authService.validateUser(userId);
    if (!userExists) {
      throw new UnauthorizedAccessError('User not found or deleted');
    }
  }

  private normalizeFolderPath(folderPath?: string): string {
    return folderPath
      ? folderPath.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\/+|\/+$/g, '')
      : '';
  }

  private async resolveUploadFolderPath(
    userId: string,
    folderPath: string | undefined,
    parentFolderId: string | undefined,
    isShared: boolean,
  ): Promise<string> {
    const normalizedPath = this.normalizeFolderPath(folderPath);
    let resolvedPath = normalizedPath;

    if (parentFolderId) {
      const parentFolder = await this.prisma.folderPermission.findUnique({
        where: { id: parentFolderId },
      });

      const hasAccess = isShared
        ? parentFolder?.isShared
        : parentFolder?.userId === userId && !parentFolder?.isShared;

      if (!parentFolder || parentFolder.isDeleted || !hasAccess) {
        throw new FolderNotFoundError(
          'Parent folder not found or not owned by user',
        );
      }

      if (!normalizedPath) {
        resolvedPath = parentFolder.folderPath;
      } else if (
        normalizedPath === parentFolder.folderPath ||
        normalizedPath.startsWith(`${parentFolder.folderPath}/`)
      ) {
        resolvedPath = normalizedPath;
      } else {
        resolvedPath = `${parentFolder.folderPath}/${normalizedPath}`;
      }
    }

    PathResolverHelper.validateFolderPath(resolvedPath);

    if (!resolvedPath) {
      return '';
    }

    const folderExists = await this.prisma.folderPermission.findFirst({
      where: isShared
        ? {
            isShared: true,
            folderPath: resolvedPath,
            isDeleted: false,
          }
        : {
            userId,
            isShared: false,
            folderPath: resolvedPath,
            isDeleted: false,
          },
      select: { id: true },
    });

    if (!folderExists) {
      throw new FolderNotFoundError('Target folder does not exist');
    }

    return resolvedPath;
  }

  /**
   * Generate presigned upload URL with hierarchy support
   */
  async generateUploadUrl(
    userId: string,
    dto: GenerateUploadUrlDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Step 1: Validate user exists
    await this.validateUserExists(userId);

    // Step 2: Resolve and validate final folder path (supports deep nesting)
    const isShared = dto.isShared || false;
    const resolvedFolderPath = await this.resolveUploadFolderPath(
      userId,
      dto.folderPath,
      dto.parentFolderId,
      isShared,
    );

    // Step 3: Resolve complete object key
    const objectKey = PathResolverHelper.resolveObjectKey(
      userId,
      resolvedFolderPath,
      dto.fileName,
      isShared,
    );

    // Step 4: Generate presigned URL
    const bucketName = this.minioService.getBucketName();
    const expiresIn = dto.expiresIn || 86400; // 24 hours default
    const url = await this.minioService.generatePresignedUrl(
      'PUT',
      objectKey,
      expiresIn,
    );

    // Step 5: Create upload session
    const session = await this.prisma.fileUploadSession.create({
      data: {
        userId,
        presignedUrl: url,
        objectKey,
        bucketName,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      },
    });

    // Step 6: Log audit entry
    await this.prisma.fileAuditLog.create({
      data: {
        userId,
        operation: 'UPLOAD',
        objectKey,
        ipAddress,
        userAgent,
        status: 'SUCCESS',
        details: `Upload URL generated for ${isShared ? 'shared' : 'user'} folder`,
      },
    });

    return {
      uploadUrl: url,
      objectKey,
      folderPath: resolvedFolderPath,
      uploadSessionId: session.id,
      expiresAt: session.expiresAt.toISOString(),
      maxChunkSize: 5242880, // 5MB
    };
  }

  /**
   * Finalize upload after client uploads bytes to MinIO.
   * This creates/updates file metadata so directory listings can show the file.
   */
  async completeUpload(
    userId: string,
    dto: CompleteUploadDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    await this.validateUserExists(userId);

    const session = await this.prisma.fileUploadSession.findUnique({
      where: { id: dto.uploadSessionId },
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedAccessError('Upload session not found');
    }

    if (session.isRevoked) {
      throw new BadRequestException('Upload session is revoked');
    }

    if (session.isUsed) {
      throw new BadRequestException('Upload session already completed');
    }

    if (session.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Upload session expired');
    }

    if (session.objectKey !== dto.objectKey) {
      throw new BadRequestException('Object key does not match upload session');
    }

    const objectStat = await this.minioService.statObject(session.objectKey);
    const pathSegments = session.objectKey.split('/');
    const fileName = pathSegments[pathSegments.length - 1];
    const folderPath = PathResolverHelper.extractFolderPath(session.objectKey);
    const isSharedFile = PathResolverHelper.isSharedFile(session.objectKey);

    let parentFolderId: string | null = null;
    if (folderPath) {
      const parentFolder = await this.prisma.folderPermission.findFirst({
        where: isSharedFile
          ? {
              isShared: true,
              folderPath,
              isDeleted: false,
            }
          : {
              userId,
              isShared: false,
              folderPath,
              isDeleted: false,
            },
        select: { id: true },
      });
      parentFolderId = parentFolder?.id || null;
    }

    const metadata = await this.prisma.fileMetadata.upsert({
      where: { objectKey: session.objectKey },
      create: {
        userId,
        fileName,
        objectKey: session.objectKey,
        bucketName: session.bucketName,
        fileSize: BigInt(objectStat.size),
        mimeType: objectStat.contentType || 'application/octet-stream',
        folderPath,
        parentFolderId,
        isSharedFile,
        isDeleted: false,
      },
      update: {
        userId,
        fileName,
        bucketName: session.bucketName,
        fileSize: BigInt(objectStat.size),
        mimeType: objectStat.contentType || 'application/octet-stream',
        folderPath,
        parentFolderId,
        isSharedFile,
        isDeleted: false,
        updatedAt: new Date(),
      },
    });

    await this.prisma.fileUploadSession.update({
      where: { id: session.id },
      data: {
        isUsed: true,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await this.prisma.fileAuditLog.create({
      data: {
        userId,
        operation: 'UPLOAD',
        objectKey: session.objectKey,
        ipAddress,
        userAgent,
        status: 'SUCCESS',
        details: 'Upload finalized and metadata persisted',
      },
    });

    return {
      fileId: metadata.id,
      fileName: metadata.fileName,
      objectKey: metadata.objectKey,
      folderPath: metadata.folderPath,
      isSharedFile: metadata.isSharedFile,
      fileSize: metadata.fileSize.toString(),
      mimeType: metadata.mimeType,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate presigned download URL
   */
  async generateDownloadUrl(
    userId: string,
    dto: GenerateDownloadUrlDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Step 1: Validate user exists
    await this.validateUserExists(userId);

    // Step 2: Find file
    const file = await this.prisma.fileMetadata.findUnique({
      where: { objectKey: dto.objectKey },
    });

    if (!file || file.isDeleted) {
      throw new FileNotFoundError('File not found');
    }

    // Step 3: Check ownership (unless shared file)
    if (!file.isSharedFile && file.userId !== userId) {
      throw new UnauthorizedAccessError('Unauthorized to access this file');
    }

    // Step 4: Generate presigned GET URL
    const expiresIn = dto.expiresIn || 3600; // 1 hour default
    const url = await this.minioService.generatePresignedUrl(
      'GET',
      dto.objectKey,
      expiresIn,
    );

    // Step 5: Log access
    await this.prisma.fileAuditLog.create({
      data: {
        userId,
        operation: 'DOWNLOAD',
        objectKey: dto.objectKey,
        ipAddress,
        userAgent,
        status: 'SUCCESS',
      },
    });

    return {
      downloadUrl: url,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      sessionId: uuidv7(),
    };
  }

  /**
   * List contents of a folder (files and subfolders)
   */
  async listFolderContents(
    userId: string,
    folderPath: string = '',
    dto: ListFolderContentsDto,
  ) {
    // Step 1: Validate user
    await this.validateUserExists(userId);

    // Step 2: Validate folder path
    PathResolverHelper.validateFolderPath(folderPath);

    // Step 3: Get offset and limit
    const offset = dto.offset || 0;
    const limit = Math.min(dto.limit || 20, 100); // Max 100 items per page

    // Step 4: Find files in folder
    const files = await this.prisma.fileMetadata.findMany({
      where: {
        userId,
        folderPath,
        isDeleted: false,
      },
      skip: offset,
      take: limit,
      select: {
        id: true,
        fileName: true,
        objectKey: true,
        fileSize: true,
        mimeType: true,
        createdAt: true,
        updatedAt: true,
        imageMetadata: true,
      },
    });
    const serializedFiles = files.map((file) => ({
      ...file,
      fileSize: file.fileSize.toString(),
    }));

    // Step 5: Count total files
    const totalFiles = await this.prisma.fileMetadata.count({
      where: {
        userId,
        folderPath,
        isDeleted: false,
      },
    });

    // Step 6: Find subfolders
    const folders = await this.prisma.folderPermission.findMany({
      where: {
        userId,
        parentPath: folderPath,
        isShared: false,
        isDeleted: false,
      },
      select: {
        id: true,
        folderName: true,
        folderPath: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      files: serializedFiles,
      folders,
      pagination: {
        total: totalFiles,
        offset,
        limit,
        hasMore: offset + limit < totalFiles,
      },
    };
  }

  async listFolderContentsByFolderId(
    userId: string,
    folderId: string,
    dto: ListFolderContentsDto,
  ) {
    await this.validateUserExists(userId);

    const folder = await this.prisma.folderPermission.findUnique({
      where: { id: folderId },
      select: {
        folderPath: true,
        userId: true,
        isShared: true,
        isDeleted: true,
      },
    });

    if (
      !folder ||
      folder.isDeleted ||
      folder.isShared ||
      folder.userId !== userId
    ) {
      throw new FolderNotFoundError('Folder not found');
    }

    return this.listFolderContents(userId, folder.folderPath, dto);
  }

  /**
   * Get complete folder tree for user
   */
  async getBucketTree(userId: string) {
    // Validate user
    await this.validateUserExists(userId);

    // Get all folders
    const folders = await this.prisma.folderPermission.findMany({
      where: {
        userId,
        isShared: false,
        isDeleted: false,
      },
      orderBy: { folderPath: 'asc' },
    });

    // Get file summary per folder
    const fileCounts = await this.prisma.fileMetadata.groupBy({
      by: ['folderPath'],
      where: {
        userId,
        isSharedFile: false,
        isDeleted: false,
      },
      _count: {
        _all: true,
      },
    });

    const countMap = new Map(
      fileCounts.map((f) => [f.folderPath, f._count._all]),
    );

    // Build tree structure
    const tree = folders.map((folder) => ({
      id: folder.id,
      folderName: folder.folderName,
      folderPath: folder.folderPath,
      parentFolderId: folder.parentFolderId,
      fileCount: countMap.get(folder.folderPath) || 0,
      depth: PathResolverHelper.getFolderDepth(folder.folderPath),
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    }));

    return tree;
  }

  /**
   * Delete all files and folders for a user (cascade soft delete)
   */
  async deleteAllUserFiles(userId: string): Promise<{
    filesDeleted: number;
    foldersDeleted: number;
  }> {
    // Soft delete all files for user
    const filesResult = await this.prisma.fileMetadata.updateMany({
      where: {
        userId,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
        updatedAt: new Date(),
      },
    });

    // Soft delete all folders for user
    const foldersResult = await this.prisma.folderPermission.updateMany({
      where: {
        userId,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `User ${userId} files deleted: ${filesResult.count}, folders deleted: ${foldersResult.count}`,
    );

    return {
      filesDeleted: filesResult.count,
      foldersDeleted: foldersResult.count,
    };
  }

  /**
   * Soft delete a folder and all nested items
   */
  async softDeleteFolderAndChildren(
    folderId: string,
    userId: string,
  ): Promise<number> {
    // Find folder
    const folder = await this.prisma.folderPermission.findUnique({
      where: { id: folderId },
    });

    if (!folder || folder.userId !== userId) {
      throw new FolderNotFoundError('Folder not found or not owned by user');
    }

    // Find all nested folders
    const nestedFolders = await this.prisma.folderPermission.findMany({
      where: {
        userId,
        folderPath: {
          startsWith: folder.folderPath,
        },
      },
    });

    const nestedFolderIds = nestedFolders.map((f) => f.id);
    nestedFolderIds.push(folderId); // Include parent

    // Soft delete all nested folders
    const deletedFolders = await this.prisma.folderPermission.updateMany({
      where: {
        id: {
          in: nestedFolderIds,
        },
      },
      data: {
        isDeleted: true,
        updatedAt: new Date(),
      },
    });

    // Soft delete all files in nested folders
    const deletedFiles = await this.prisma.fileMetadata.updateMany({
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

    this.logger.log(
      `Soft deleted folder ${folderId}: ${deletedFolders.count} folders, ${deletedFiles.count} files`,
    );

    return deletedFolders.count + deletedFiles.count;
  }
}
