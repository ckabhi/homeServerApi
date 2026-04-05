import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CompleteUploadDto {
  @IsUUID()
  @IsNotEmpty()
  uploadSessionId!: string;

  @IsString()
  @IsNotEmpty()
  objectKey!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  systemFileName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  displayName?: string;
}
