import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  Matches,
  IsUUID,
} from 'class-validator';

export class CreateSharedFolderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(25, { message: 'Folder name cannot exceed 25 characters' })
  @Matches(/^[a-zA-Z0-9_\- ]+$/, {
    message:
      'Folder name can only contain alphanumeric characters, hyphens, underscores, and spaces',
  })
  folderName: string;

  @IsOptional()
  @IsUUID()
  parentFolderId?: string;
}
