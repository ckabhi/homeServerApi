import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MinioService } from '../minio.service';
import { AuthService } from '../../authentication/auth.service';
import { FilesService } from '../files.service';
import { UploadToSharedDto } from '../dto/upload-to-shared.dto';
import { CreateSharedFolderDto } from '../dto/create-shared-folder.dto';
import { CompleteUploadDto } from '../dto/complete-upload.dto';
import {
  FolderNotFoundError,
  UnauthorizedAccessError,
  InvalidFolderPathError,
} from '../exceptions/file-errors';
import { PathResolverHelper } from '../helpers/path-resolver.helper';
import { DuplicateNameHelper } from '../helpers/duplicate-name.helper';
import { RenameFolderDto } from '../dto/rename-folder.dto';
import { calculateChunkSize } from '../helpers/chunk-size.helper';
import ms, { StringValue } from 'ms';

interface SharedTreeNode {
  id: string;
  folderName: string;
  folderPath: string;
  fileCount: number;
  children: SharedTreeNode[];
}

@Injectable()
export class SharedFilesService {
  private readonly logger = new Logger(SharedFilesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    private readonly filesService: FilesService,
    private readonly duplicateNameHelper: DuplicateNameHelper,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private buildSharedTree(
    items: Array<{
      id: string;
      folderName: string;
      folderPath: string;
      parentFolderId: string | null;
    }>,
    countMap: Map<string, number>,
    parentId?: string | null,
  ): SharedTreeNode[] {
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
        fileCount: countMap.get(item.folderPath) || 0,
        children: this.buildSharedTree(items, countMap, item.id),
      }));
  }

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
   * Generate presigned URL for uploading to shared folder
   */
  async uploadToSharedFolder(
    userId: string,
    dto: UploadToSharedDto,
    ipAddress?: string,
  ) {
    // Step 1: Validate user
    await this.validateUserExists(userId);

    // Step 2: Validate folder path and ensure target folder exists (for nested paths)
    const resolvedFolderPath = dto.folderPath
      ? dto.folderPath
          .trim()
          .replace(/\\/g, '/')
          .replace(/\/{2,}/g, '/')
          .replace(/^\/+|\/+$/g, '')
      : '';
    PathResolverHelper.validateFolderPath(resolvedFolderPath);

    let parentFolderId: string | null = null;
    if (resolvedFolderPath) {
      const folder = await this.prisma.folderPermission.findFirst({
        where: {
          isShared: true,
          folderPath: resolvedFolderPath,
          isDeleted: false,
        },
        select: { id: true },
      });
      if (!folder) {
        throw new FolderNotFoundError('Target shared folder does not exist');
      }
      parentFolderId = folder.id;
    }

    const displayName =
      await this.duplicateNameHelper.generateUniqueDisplayName(
        userId,
        dto.fileName,
        parentFolderId,
        true,
      );
    const systemFileName = PathResolverHelper.generateSystemFileName(
      dto.fileName,
    );
    const objectKey = PathResolverHelper.resolveObjectKeyFlat(
      userId,
      systemFileName,
      true,
    );
    const dirPath = PathResolverHelper.constructDirPath(
      'shared',
      resolvedFolderPath,
      displayName,
    );

    // Step 4: Generate presigned URL
    const expiresIn = dto.expiresIn || 300; // 1 hour for shared uploads
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
        displayName,
        systemFileName,
        folderPath: resolvedFolderPath,
        parentFolderId,
        isSharedFile: true,
        bucketName: this.minioService.getBucketName(),
        ipAddress,
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
        status: 'SUCCESS',
        details: 'Upload URL generated for shared folder',
      },
    });

    return {
      uploadUrl: url,
      objectKey,
      displayName,
      systemFileName,
      dirPath,
      folderPath: resolvedFolderPath,
      parentFolderId,
      uploadSessionId: session.id,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  async completeSharedUpload(
    userId: string,
    dto: CompleteUploadDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const result = await this.filesService.completeUpload(
      userId,
      dto,
      ipAddress,
      userAgent,
    );

    if (!result.isSharedFile) {
      throw new InvalidFolderPathError(
        'Upload session is not associated with shared space',
      );
    }

    return result;
  }

  /**
   * List files in shared folder (public access)
   */
  async listSharedFolder(folderPath?: string) {
    // Step 1: Validate path
    PathResolverHelper.validateFolderPath(folderPath || '');

    // Step 2: Query shared files
    const files = await this.prisma.fileMetadata.findMany({
      where: {
        isSharedFile: true,
        isDeleted: false,
        folderPath: folderPath || '',
      },
      select: {
        id: true,
        displayName: true,
        objectKey: true,
        systemFileName: true,
        fileSize: true,
        mimeType: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    const serializedFiles = files.map((file) => ({
      ...file,
      fileSize: file.fileSize.toString(),
    }));

    // Step 3: Query shared subfolders
    const folders = await this.prisma.folderPermission.findMany({
      where: {
        isShared: true,
        isDeleted: false,
        parentPath: folderPath || '',
      },
      select: {
        id: true,
        folderName: true,
        folderPath: true,
        createdAt: true,
      },
      orderBy: { folderName: 'asc' },
    });

    return {
      files: serializedFiles,
      folders,
      folderPath: folderPath || 'root',
    };
  }

  /**
   * Get complete shared folder tree structure
   */
  async getSharedFolderTree() {
    // Get all shared folders
    const folders = await this.prisma.folderPermission.findMany({
      where: {
        isShared: true,
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

    // Get file counts per folder
    const fileCounts = await this.prisma.fileMetadata.groupBy({
      by: ['folderPath'],
      where: {
        isSharedFile: true,
        isDeleted: false,
      },
      _count: {
        _all: true,
      },
    });

    const countMap = new Map(
      fileCounts.map((f) => [f.folderPath, f._count._all]),
    );

    return this.buildSharedTree(folders, countMap);
  }

  /**
   * Create a shared folder (admin only)
   */
  async createSharedFolder(dto: CreateSharedFolderDto) {
    // Step 1: Validate folder name
    const sanitizedName = PathResolverHelper.sanitizeFolderName(dto.folderName);
    if (!sanitizedName) {
      throw new InvalidFolderPathError('Folder name is invalid');
    }

    // Step 2: Calculate path
    const { folderPath, parentPath } = dto.parentFolderId
      ? await this.buildSharedFolderPath(dto.parentFolderId, sanitizedName)
      : { folderPath: sanitizedName, parentPath: '' };

    // Step 3: Check uniqueness
    const existing = await this.prisma.folderPermission.findFirst({
      where: {
        isShared: true,
        folderPath,
        isDeleted: false,
      },
    });

    if (existing) {
      throw new InvalidFolderPathError(
        'Shared folder already exists at this path',
      );
    }

    // Step 4: Create folder (system owned)
    const folder = await this.prisma.folderPermission.create({
      data: {
        userId: 'SYSTEM', // System-owned shared folders
        folderName: sanitizedName,
        folderPath,
        parentPath,
        parentFolderId: dto.parentFolderId,
        isShared: true,
      },
    });

    // Step 5: Log creation
    await this.prisma.fileAuditLog.create({
      data: {
        userId: 'SYSTEM',
        operation: 'CREATE',
        objectKey: folder.id,
        status: 'SUCCESS',
        details: `Shared folder created at path: ${folderPath}`,
      },
    });

    this.logger.log(`Shared folder created: ${folderPath}`);

    return {
      id: folder.id,
      folderName: folder.folderName,
      folderPath: folder.folderPath,
      createdAt: folder.createdAt,
    };
  }

  /**
   * Rename a shared folder
   */
  async renameSharedFolder(
    userId: string,
    folderId: string,
    dto: RenameFolderDto,
  ) {
    // Step 1: Validate user
    // await this.validateUserExists(userId);

    // Step 2: Find folder
    const folder = await this.prisma.folderPermission.findUnique({
      where: { id: folderId },
    });

    if (!folder || !folder.isShared) {
      throw new FolderNotFoundError('Shared folder not found');
    }

    const folderName = PathResolverHelper.sanitizeFolderName(dto.newFolderName);
    if (!folderName) {
      throw new InvalidFolderPathError('Invalid folder name');
    }

    // Check for duplicate folder name under the same parent
    const existing = await this.prisma.folderPermission.findFirst({
      where: {
        isShared: true,
        folderName,
        parentFolderId: folder.parentFolderId,
        isDeleted: false,
        NOT: { id: folder.id },
      },
    });
    if (existing) {
      throw new InvalidFolderPathError(
        'A sibling shared folder with the same name already exists',
      );
    }
    // Step 3: Update folder name
    const updated = await this.prisma.folderPermission.update({
      where: { id: folderId },
      data: { folderName: dto.newFolderName },
    });

    // Step 4: Log audit entry
    await this.prisma.fileAuditLog.create({
      data: {
        userId,
        operation: 'RENAME',
        objectKey: folderId,
        status: 'SUCCESS',
        details: `Shared folder renamed to: ${dto.newFolderName}`,
      },
    });

    return updated;
  }

  /**
   * Delete from shared folder
   */
  async deleteFromSharedFolder(userId: string, objectKey: string) {
    // Step 1: Validate user
    await this.validateUserExists(userId);

    // Step 2: Find file
    const file = await this.prisma.fileMetadata.findUnique({
      where: { objectKey },
    });

    if (!file || !file.isSharedFile || file.isDeleted) {
      throw new FolderNotFoundError('Shared file not found');
    }

    // Step 3: Soft delete file
    await this.prisma.fileMetadata.update({
      where: { id: file.id },
      data: {
        isDeleted: true,
        updatedAt: new Date(),
      },
    });

    // Step 4: Log audit entry
    await this.prisma.fileAuditLog.create({
      data: {
        userId,
        operation: 'DELETE',
        objectKey,
        status: 'SUCCESS',
        details: 'File deleted from shared folder',
      },
    });

    return {
      message: 'File deleted from shared folder',
      objectKey,
    };
  }

  /**
   * Generate download URL for shared file (public)
   */
  async downloadFromShared(objectKey: string, ipAddress?: string) {
    // Step 1: Verify file exists and is shared
    const file = await this.prisma.fileMetadata.findUnique({
      where: { objectKey },
    });

    if (!file || !file.isSharedFile || file.isDeleted) {
      throw new FolderNotFoundError('Shared file not found');
    }

    // Step 2: Generate presigned GET URL
    const expiresIn =
      ms(this.configService.get<StringValue>('SIGNED_URL_EXPIRATION', '5m')) /
      1000; // Convert to seconds
    const url = await this.minioService.generatePresignedDownloadUrl(
      objectKey,
      file.displayName,
      expiresIn,
    );

    // Step 3: Log access (public, so no userId)
    await this.prisma.fileAuditLog.create({
      data: {
        userId: 'PUBLIC',
        operation: 'DOWNLOAD',
        objectKey,
        ipAddress,
        status: 'SUCCESS',
        details: 'Public shared file download',
      },
    });

    return {
      downloadUrl: url,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      displayName: file.displayName,
    };
  }

  /**
   * Initialize a multipart upload to a shared folder
   */
  async initSharedMultipartUpload(
    userId: string,
    dto: {
      fileName: string;
      folderPath?: string;
      mimeType: string;
      fileSize: number;
    },
    ipAddress?: string,
  ) {
    await this.validateUserExists(userId);

    const resolvedFolderPath = dto.folderPath
      ? dto.folderPath
          .trim()
          .replace(/\\/g, '/')
          .replace(/\/{2,}/g, '/')
          .replace(/^\/+|\/+$/g, '')
      : '';
    PathResolverHelper.validateFolderPath(resolvedFolderPath);

    let parentFolderId: string | null = null;
    if (resolvedFolderPath) {
      const folder = await this.prisma.folderPermission.findFirst({
        where: {
          isShared: true,
          folderPath: resolvedFolderPath,
          isDeleted: false,
        },
        select: { id: true },
      });
      if (!folder) {
        throw new FolderNotFoundError('Target shared folder does not exist');
      }
      parentFolderId = folder.id;
    }

    const displayName =
      await this.duplicateNameHelper.generateUniqueDisplayName(
        userId,
        dto.fileName,
        parentFolderId,
        true,
      );
    const systemFileName = PathResolverHelper.generateSystemFileName(
      dto.fileName,
    );
    const objectKey = PathResolverHelper.resolveObjectKeyFlat(
      userId,
      systemFileName,
      true,
    );

    const { chunkSize, totalChunks } = calculateChunkSize(dto.fileSize);

    const uploadId = await this.minioService.initiateMultipartUpload(objectKey);

    const bucketName = this.minioService.getBucketName();
    const expiresIn =
      ms(this.configService.get<StringValue>('SIGNED_URL_EXPIRATION', '5m')) /
      1000; // Convert to seconds

    const session = await this.prisma.fileUploadSession.create({
      data: {
        userId,
        presignedUrl: '',
        objectKey,
        displayName,
        systemFileName,
        folderPath: resolvedFolderPath,
        parentFolderId,
        isSharedFile: true,
        bucketName,
        ipAddress,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        isMultipart: true,
        uploadId,
        totalChunks,
        chunkSize,
      },
    });

    await this.prisma.fileAuditLog.create({
      data: {
        userId,
        operation: 'UPLOAD',
        objectKey,
        ipAddress,
        status: 'SUCCESS',
        details: `Shared multipart upload initiated (${totalChunks} chunks)`,
      },
    });

    return {
      uploadSessionId: session.id,
      uploadId,
      objectKey,
      displayName,
      systemFileName,
      folderPath: resolvedFolderPath,
      parentFolderId,
      chunkSize,
      totalChunks,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  /**
   * Generate presigned URLs for shared multipart upload parts
   */
  async generateSharedPartUrls(
    userId: string,
    uploadSessionId: string,
    partNumbers: number[],
  ) {
    return this.filesService.generatePartUrls(
      userId,
      uploadSessionId,
      partNumbers,
    );
  }

  /**
   * Complete a shared multipart upload
   */
  async completeSharedMultipartUpload(
    userId: string,
    uploadSessionId: string,
    parts: { partNumber: number; etag: string }[],
    ipAddress?: string,
    userAgent?: string,
  ) {
    const result = await this.filesService.completeMultipartUpload(
      userId,
      uploadSessionId,
      parts,
      ipAddress,
      userAgent,
    );

    if (!result.isSharedFile) {
      throw new InvalidFolderPathError(
        'Upload session is not associated with shared space',
      );
    }

    return result;
  }

  /**
   * Helper: Build shared folder path
   */
  private async buildSharedFolderPath(
    parentFolderId: string,
    folderName: string,
  ): Promise<{ folderPath: string; parentPath: string }> {
    const parent = await this.prisma.folderPermission.findUnique({
      where: { id: parentFolderId },
    });

    if (!parent || !parent.isShared) {
      throw new FolderNotFoundError('Parent shared folder not found');
    }

    return {
      folderPath: `${parent.folderPath}/${folderName}`,
      parentPath: parent.folderPath,
    };
  }
}
