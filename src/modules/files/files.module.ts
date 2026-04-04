import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { MinioService } from './minio.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../authentication/auth.module';
import { FolderService } from './services/folder.service';
import { SharedFilesService } from './services/shared-files.service';
import { SharedFilesController } from './shared-files.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FilesController, SharedFilesController],
  providers: [FilesService, MinioService, FolderService, SharedFilesService],
  exports: [FilesService, MinioService, FolderService, SharedFilesService],
})
export class FilesModule {}
