import { BadRequestException } from '@nestjs/common';

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
  ): string {
    const cleanFolderPath = folderPath
      ? this.normalizeFolderPath(folderPath)
      : '';
    const cleanFileName = fileName.trim().replace(/^\/+|\/+$/g, '');

    if (isShared) {
      return cleanFolderPath
        ? `shared/${cleanFolderPath}/${cleanFileName}`
        : `shared/${cleanFileName}`;
    }

    return cleanFolderPath
      ? `${userId}/${cleanFolderPath}/${cleanFileName}`
      : `${userId}/${cleanFileName}`;
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
