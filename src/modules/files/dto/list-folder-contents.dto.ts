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

export class ListFolderContentsResponseDto {
  files: Array<{
    id: string;
    fileName: string;
    objectKey: string;
    fileSize: number;
    mimeType: string;
    createdAt: Date;
    updatedAt: Date;
  }>;

  folders: Array<{
    id: string;
    folderName: string;
    folderPath: string;
    createdAt: Date;
    updatedAt: Date;
  }>;

  pagination: {
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  };
}
