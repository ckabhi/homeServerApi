import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsUUID,
  MaxLength,
  Min,
  Max,
  Matches,
} from 'class-validator';

export class InitMultipartUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^[^<>:"/\\|?*]+$/, {
    message: 'fileName contains invalid characters',
  })
  fileName!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  folderPath?: string;

  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  @Max(5368709120, { message: 'File size cannot exceed 5GB' })
  fileSize!: number;

  @IsOptional()
  @IsUUID()
  parentFolderId?: string;

  @IsOptional()
  @IsBoolean()
  isShared?: boolean;
}
