import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { MinioService } from './minio.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../authentication/auth.module';
import { FolderService } from './services/folder.service';
import { SharedFilesService } from './services/shared-files.service';
import { SharedFilesController } from './shared-files.controller';
import { DuplicateNameHelper } from './helpers/duplicate-name.helper';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FilesController, SharedFilesController],
  providers: [
    FilesService,
    MinioService,
    FolderService,
    SharedFilesService,
    DuplicateNameHelper,
  ],
  exports: [
    FilesService,
    MinioService,
    FolderService,
    SharedFilesService,
    DuplicateNameHelper,
  ],
})
export class FilesModule {}
