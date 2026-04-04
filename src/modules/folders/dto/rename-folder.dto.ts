import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';

export class RenameFolderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(25, { message: 'Folder name is too long' })
  @Matches(/^[a-zA-Z0-9_\- ]+$/, { message: 'Folder name contains invalid characters' })
  newFolderName: string;
}
