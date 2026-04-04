import {
  IsString,
  IsNotEmpty,
  MaxLength,
  Matches,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(25, { message: 'Folder name is too long' })
  @Matches(/^[a-zA-Z0-9_\- ]+$/, { message: 'Folder name contains invalid characters' })
  folderName: string;

  @IsOptional()
  @IsUUID()
  parentFolderId?: string;
}
