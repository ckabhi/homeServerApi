import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class UploadToSharedDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsOptional()
  @IsString()
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
  @IsNumber()
  @Min(60)
  @Max(604800)
  expiresIn?: number;
}
