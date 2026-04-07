import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  Req,
  Get,
  Param,
  Query,
  Patch,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { GenerateUploadUrlDto } from './dto/generate-upload-url.dto';
import { GenerateDownloadUrlDto } from './dto/generate-download-url.dto';
import { ListFolderContentsDto } from './dto/list-folder-contents.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { RenameFileDto } from './dto/rename-file.dto';
import { CreateFolderDto } from './dto/create-folder.dto';
import { FolderService } from './services/folder.service';
import { RenameFolderDto } from './dto/rename-folder.dto';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly foldersService: FolderService,
  ) {}

  private getUserId(
    req: Request & { user?: { id?: string; userId?: string } },
  ): string {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Invalid token payload: user id missing');
    }
    return userId;
  }

  private getClientIp(req: Request): string | undefined {
    return req.ip;
  }

  private getUserAgent(req: Request): string | undefined {
    return req.get('user-agent') || undefined;
  }

  @Patch(':fileId/rename')
  async renameFile(
    @Req() req: Request & { user?: { id?: string; userId?: string } },
    @Param('fileId') fileId: string,
    @Body() dto: RenameFileDto,
  ) {
    return this.filesService.renameFile(
      fileId,
      this.getUserId(req),
      dto.newDisplayName,
    );
  }

  @Post('upload-url')
  async getUploadUrl(
    @Req() req: Request & { user?: { id?: string; userId?: string } },
    @Body() dto: GenerateUploadUrlDto,
  ) {
    const userId = this.getUserId(req);
    return this.filesService.generateUploadUrl(
      userId,
      dto,
      this.getClientIp(req),
      this.getUserAgent(req),
    );
  }

  @Post('download-url')
  async getDownloadUrl(
    @Req() req: Request & { user?: { id?: string; userId?: string } },
    @Body() dto: GenerateDownloadUrlDto,
  ) {
    const userId = this.getUserId(req);
    return this.filesService.generateDownloadUrl(
      userId,
      dto,
      this.getClientIp(req),
      this.getUserAgent(req),
    );
  }

  @Post('upload-complete')
  async completeUpload(
    @Req() req: Request & { user?: { id?: string; userId?: string } },
    @Body() dto: CompleteUploadDto,
  ) {
    return this.filesService.completeUpload(
      this.getUserId(req),
      dto,
      this.getClientIp(req),
      this.getUserAgent(req),
    );
  }

  @Get('folders/:folderId/contents')
  async getFolderContents(
    @Req() req: Request & { user?: { id?: string; userId?: string } },
    @Param('folderId') folderId: string,
    @Query() dto: ListFolderContentsDto,
  ) {
    return this.filesService.listFolderContentsByFolderId(
      this.getUserId(req),
      folderId,
      dto,
    );
  }

  @Post('folders')
  async createFolder(@Req() req: any, @Body() dto: CreateFolderDto) {
    return this.foldersService.createFolder(this.getUserId(req), dto);
  }

  @Delete('folders/:folderId')
  async deleteFolder(
    @Req() req: any,
    @Param('folderId') folderId: string,
    @Query('force') force?: string,
  ) {
    return this.foldersService.deleteFolder(
      this.getUserId(req),
      folderId,
      force === 'true',
    );
  }

  @Patch('folders/:folderId/rename')
  async renameFolder(
    @Req() req: any,
    @Param('folderId') folderId: string,
    @Body() dto: RenameFolderDto,
  ) {
    return this.foldersService.renameFolder(this.getUserId(req), folderId, dto);
  }
  // Added by the AI
  @Get('folder')
  async listFolder(
    @Req() req: Request & { user?: { id?: string; userId?: string } },
    @Query() dto: ListFolderContentsDto,
  ) {
    return this.filesService.listFolderContents(
      this.getUserId(req),
      dto.folderPath ?? '',
      dto,
    );
  }

  @Get('folder/:folderPath')
  async listFolderByPath(
    @Req() req: Request & { user?: { id?: string; userId?: string } },
    @Param('folderPath') folderPath: string,
    @Query() dto: ListFolderContentsDto,
  ) {
    return this.filesService.listFolderContents(
      this.getUserId(req),
      decodeURIComponent(folderPath),
      dto,
    );
  }

  @Get('tree')
  async getBucketTree(
    @Req() req: Request & { user?: { id?: string; userId?: string } },
  ) {
    // return this.filesService.getBucketTree(this.getUserId(req));
    return this.foldersService.getFolderHierarchy(this.getUserId(req));
  }
}
