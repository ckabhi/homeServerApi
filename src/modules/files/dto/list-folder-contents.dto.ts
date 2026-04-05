import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListFolderContentsDto {
  @IsOptional()
  @IsString()
  folderPath?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class FileItemDto {
  id!: string;
  displayName!: string;
  objectKey!: string;
  systemFileName!: string;
  fileSize!: string;
  mimeType!: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export class FolderItemDto {
  id!: string;
  folderName!: string;
  folderPath!: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export class ListFolderContentsResponseDto {
  files!: FileItemDto[];
  folders!: FolderItemDto[];

  pagination!: {
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  };
}
