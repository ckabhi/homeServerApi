import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';

/**
 * Path Resolution Helper - Handles folder path and object key generation
 */
export class PathResolverHelper {
  private static readonly MAX_FOLDER_PATH_LENGTH = 500;
  private static readonly MAX_FOLDER_NAME_LENGTH = 25;

  private static normalizeFolderPath(folderPath: string): string {
    return folderPath
      .trim()
      .replace(/\\/g, '/')
      .replace(/\/{2,}/g, '/')
      .replace(/^\/+|\/+$/g, '');
  }

  /**
   * Resolve MinIO object key based on file storage context
   * @param userId User identifier
   * @param folderPath Complete folder path
   * @param fileName File name with extension
   * @param isShared Whether this is a shared folder file
   * @returns Full object key for MinIO
   */
  static resolveObjectKey(
    userId: string,
    folderPath: string,
    fileName: string,
    isShared: boolean = false,
  ): { objectKey: string; dirPath: string } {
    const cleanFolderPath = folderPath
      ? this.normalizeFolderPath(folderPath)
      : '';
    const cleanFileName = fileName.trim().replace(/^\/+|\/+$/g, '');

    if (isShared) {
      const sharedDirPath = cleanFolderPath
        ? `shared/${cleanFolderPath}/${cleanFileName}`
        : `shared/${cleanFileName}`;
      return { objectKey: `shared/${cleanFileName}`, dirPath: sharedDirPath };
    }

    const privateDirPath = cleanFolderPath
      ? `${userId}/${cleanFolderPath}/${cleanFileName}`
      : `${userId}/${cleanFileName}`;
    return { objectKey: `${userId}/${cleanFileName}`, dirPath: privateDirPath };
  }

  /**
   * Generate system filename for storage (UUID + extension)
   * @param originalFileName Original filename provided by user
   * @returns System filename (e.g., "550e8400-e29b-41d4-a716-446655440000.pdf")
   */
  static generateSystemFileName(originalFileName: string): string {
    const extension = this.extractExtension(originalFileName);
    return `${this.generateUUID()}${extension}`;
  }

  /**
   * Extract file extension from filename
   * @param fileName Filename to extract extension from
   * @returns Extension with dot (e.g., ".pdf") or empty string
   */
  static extractExtension(fileName: string): string {
    const normalizedFileName = fileName.trim();
    const lastDot = normalizedFileName.lastIndexOf('.');
    if (lastDot <= 0 || lastDot === normalizedFileName.length - 1) {
      return '';
    }
    return normalizedFileName.substring(lastDot);
  }

  /**
   * Generate UUID v7 for timestamp-based ordering
   * @returns UUID v7 string
   */
  static generateUUID(): string {
    const timestamp = BigInt(Date.now());
    const random = randomBytes(10);

    const timeHex = timestamp.toString(16).padStart(12, '0');
    const randHex = random.toString('hex');

    const part1 = timeHex.slice(0, 8);
    const part2 = timeHex.slice(8, 12);
    const part3 = `7${randHex.slice(0, 3)}`;
    const variantNibble = (parseInt(randHex.slice(3, 4), 16) & 0x3) | 0x8;
    const part4 = `${variantNibble.toString(16)}${randHex.slice(4, 7)}`;
    const part5 = randHex.slice(7, 19);

    return `${part1}-${part2}-${part3}-${part4}-${part5}`;
  }

  /**
   * Resolve object key for flat storage structure
   * Pattern: <userID>/<systemFileName> or shared/<systemFileName>
   * @param userId User ID
   * @param systemFileName System generated filename
   * @param isShared Whether file is in shared folder
   * @returns Object key for MinIO storage
   */
  static resolveObjectKeyFlat(
    userId: string,
    systemFileName: string,
    isShared: boolean = false,
  ): string {
    if (isShared) {
      return `shared/${systemFileName}`;
    }

    return `${userId}/${systemFileName}`;
  }

  /**
   * Construct dirPath for API responses
   * Pattern: userId/folderPath/displayName
   * @param userId User ID or "shared"
   * @param folderPath Logical folder path from database
   * @param displayName User-facing filename
   * @returns Full path for display and audit
   */
  static constructDirPath(
    userId: string,
    folderPath: string = '',
    displayName: string,
  ): string {
    const cleanFolderPath = folderPath
      ? this.normalizeFolderPath(folderPath)
      : '';
    const cleanDisplayName = displayName.trim().replace(/^\/+|\/+$/g, '');
    return cleanFolderPath
      ? `${userId}/${cleanFolderPath}/${cleanDisplayName}`
      : `${userId}/${cleanDisplayName}`;
  }

  /**
   * Validate folder path for security and format issues
   * @param folderPath Path to validate
   * @throws BadRequestException if path is invalid
   * @returns true if valid
   */
  static validateFolderPath(folderPath: string): boolean {
    if (!folderPath) return true; // Empty path is valid (root)

    const normalized = this.normalizeFolderPath(folderPath);

    // Check for path traversal
    if (normalized.includes('../') || normalized.includes('..\\')) {
      throw new BadRequestException(
        'Path traversal detected: ".." is not allowed',
      );
    }

    // Check for absolute paths
    if (folderPath.startsWith('/') || folderPath.startsWith('\\')) {
      throw new BadRequestException('Absolute paths are not allowed');
    }

    // Check length
    if (normalized.length > this.MAX_FOLDER_PATH_LENGTH) {
      throw new BadRequestException(
        'Folder path exceeds maximum length of 500 characters',
      );
    }

    // Check for null bytes
    if (normalized.includes('\0')) {
      throw new BadRequestException('Null bytes are not allowed in path');
    }

    if (/[<>:|?*]/.test(normalized)) {
      throw new BadRequestException(
        'Folder path contains disallowed characters',
      );
    }

    // Check for control characters
    for (const char of normalized) {
      if (char.charCodeAt(0) < 32) {
        throw new BadRequestException(
          'Control characters are not allowed in path',
        );
      }
    }

    return true;
  }

  /**
   * Sanitize folder name for storage
   * @param name Folder name to sanitize
   * @returns Sanitized folder name
   */
  static sanitizeFolderName(name: string): string {
    if (!name) return '';

    let clean = name
      .trim()
      .replace(/^\.+|\.+$/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[^a-zA-Z0-9.\-_ ]+/g, '');

    if (clean.length > this.MAX_FOLDER_NAME_LENGTH) {
      clean = clean.substring(0, this.MAX_FOLDER_NAME_LENGTH).trim();
    }

    return clean.replace(/^\.+|\.+$/g, '');
  }

  /**
   * Extract folder path from object key
   * @param objectKey Complete object key (e.g., "userId/folder/file.pdf")
   * @returns Folder path without userId/shared prefix and filename
   */
  static extractFolderPath(objectKey: string): string {
    const cleanKey = objectKey.replace(/^\/+|\/+$/g, '');
    const parts = cleanKey.split('/');

    // Remove first part (userId or "shared")
    parts.shift();

    // Remove last part (filename)
    if (parts.length > 0) {
      parts.pop();
    }

    // Return remaining path or empty string for root
    return parts.join('/');
  }

  /**
   * Get folder depth (number of nesting levels)
   * @param folderPath Path to check
   * @returns Depth count (0 = root, 1 = one level, etc)
   */
  static getFolderDepth(folderPath: string): number {
    if (!folderPath || folderPath.trim() === '') return 0;
    const cleanPath = this.normalizeFolderPath(folderPath);
    if (!cleanPath) return 0;
    return (cleanPath.match(/\//g) || []).length;
  }

  /**
   * Extract user ID from object key
   * @param objectKey Object key from MinIO
   * @returns User ID or "shared" if shared folder
   */
  static extractUserIdFromObjectKey(objectKey: string): string {
    const firstPart = objectKey.split('/')[0];
    return firstPart;
  }

  /**
   * Check if object key is in shared folder
   * @param objectKey Object key to check
   * @returns true if path starts with "shared/"
   */
  static isSharedFile(objectKey: string): boolean {
    return objectKey.startsWith('shared/');
  }
}
