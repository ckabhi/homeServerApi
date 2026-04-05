import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DuplicateNameHelper {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate unique display name by appending (copy), (copy 1), etc.
   * @param userId User ID
   * @param displayName Desired display name
   * @param parentFolderId Parent folder ID (null for root)
   * @param isShared Whether file is in shared folder
   * @param excludeFileId File ID to exclude from duplicate check
   */
  async generateUniqueDisplayName(
    userId: string,
    displayName: string,
    parentFolderId: string | null,
    isShared: boolean,
    excludeFileId?: string,
  ): Promise<string> {
    const trimmedDisplayName = displayName.trim();
    const baseNameWithoutExt = this.extractBaseName(trimmedDisplayName);
    const extension = this.extractExtension(trimmedDisplayName);

    let counter = 0;
    let candidateName = trimmedDisplayName;

    while (true) {
      const exists = await this.checkFileExists(
        userId,
        candidateName,
        parentFolderId,
        isShared,
        excludeFileId,
      );

      if (!exists) {
        return candidateName;
      }

      counter += 1;
      if (counter === 1) {
        candidateName = `${baseNameWithoutExt} (copy)${extension}`;
      } else {
        candidateName = `${baseNameWithoutExt} (copy ${counter - 1})${extension}`;
      }
    }
  }

  private async checkFileExists(
    userId: string,
    displayName: string,
    parentFolderId: string | null,
    isShared: boolean,
    excludeFileId?: string,
  ): Promise<boolean> {
    const existingFile = await this.prisma.fileMetadata.findFirst({
      where: {
        ...(isShared ? {} : { userId }),
        displayName,
        parentFolderId,
        isSharedFile: isShared,
        isDeleted: false,
        ...(excludeFileId ? { NOT: { id: excludeFileId } } : {}),
      },
      select: { id: true },
    });

    return Boolean(existingFile);
  }

  private extractBaseName(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot <= 0) {
      return fileName;
    }

    return fileName.substring(0, lastDot);
  }

  private extractExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot <= 0 || lastDot === fileName.length - 1) {
      return '';
    }

    return fileName.substring(lastDot);
  }
}
