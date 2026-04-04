import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CompleteUploadDto {
  @IsUUID()
  @IsNotEmpty()
  uploadSessionId!: string;

  @IsString()
  @IsNotEmpty()
  objectKey!: string;
}
