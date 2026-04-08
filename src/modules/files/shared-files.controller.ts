import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Patch,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SharedFilesService } from './services/shared-files.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { UploadToSharedDto } from './dto/upload-to-shared.dto';
import { CreateSharedFolderDto } from './dto/create-shared-folder.dto';
import { GenerateDownloadUrlDto } from './dto/generate-download-url.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { InitMultipartUploadDto } from './dto/init-multipart-upload.dto';
import { GetPartUrlsDto } from './dto/get-part-urls.dto';
import { CompleteMultipartUploadDto } from './dto/complete-multipart-upload.dto';
import { RenameFolderDto } from './dto/rename-folder.dto';

@Controller('shared')
export class SharedFilesController {
  constructor(private readonly sharedFilesService: SharedFilesService) {}

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

  @Post('upload-url')
  @UseGuards(JwtAuthGuard)
  async uploadUrl(
    @Req() req: Request & { user?: { id?: string; userId?: string } },
    @Body() dto: UploadToSharedDto,
  ) {
    return this.sharedFilesService.uploadToSharedFolder(
      this.getUserId(req),
      dto,
      this.getClientIp(req),
    );
  }

  @Get('tree')
  async getTree(): Promise<unknown[]> {
    return this.sharedFilesService.getSharedFolderTree();
  }

  @Get('folder')
  async listFolder(@Query('folderPath') folderPath?: string) {
    return this.sharedFilesService.listSharedFolder(folderPath);
  }

  @Get('folder/:folderPath')
  async listFolderByPath(@Param('folderPath') folderPath: string) {
    return this.sharedFilesService.listSharedFolder(
      decodeURIComponent(folderPath),
    );
  }

  @Post('download-url')
  async downloadUrl(@Body() dto: GenerateDownloadUrlDto, @Req() req: Request) {
    return this.sharedFilesService.downloadFromShared(
      dto.objectKey,
      this.getClientIp(req),
    );
  }

  @Post('folders')
  @UseGuards(JwtAuthGuard)
  async createFolder(@Body() dto: CreateSharedFolderDto) {
    return this.sharedFilesService.createSharedFolder(dto);
  }

  @Patch('folders/:folderId/rename')
  @UseGuards(JwtAuthGuard)
  async renameFolder(
    @Req() req: Request & { user?: { id?: string; userId?: string } },
    @Param('folderId') folderId: string,
    @Body() dto: RenameFolderDto,
  ) {
    return this.sharedFilesService.renameSharedFolder(
      this.getUserId(req),
      folderId,
      dto,
    );
  }

  @Post('upload-complete')
  @UseGuards(JwtAuthGuard)
  async completeUpload(
    @Req() req: Request & { user?: { id?: string; userId?: string } },
    @Body() dto: CompleteUploadDto,
  ) {
    return this.sharedFilesService.completeSharedUpload(
      this.getUserId(req),
      dto,
      this.getClientIp(req),
      this.getUserAgent(req),
    );
  }

  @Delete(':objectKey')
  @UseGuards(JwtAuthGuard)
  async deleteShared(
    @Req() req: Request & { user?: { id?: string; userId?: string } },
    @Param('objectKey') objectKey: string,
  ) {
    return this.sharedFilesService.deleteFromSharedFolder(
      this.getUserId(req),
      decodeURIComponent(objectKey),
    );
  }

  // =============================================
  // SHARED MULTIPART UPLOAD ENDPOINTS
  // =============================================

  @Post('multipart/init')
  @UseGuards(JwtAuthGuard)
  async initSharedMultipartUpload(
    @Req() req: Request & { user?: { id?: string; userId?: string } },
    @Body() dto: InitMultipartUploadDto,
  ) {
    return this.sharedFilesService.initSharedMultipartUpload(
      this.getUserId(req),
      dto,
      this.getClientIp(req),
    );
  }

  @Post('multipart/:uploadSessionId/urls')
  @UseGuards(JwtAuthGuard)
  async getSharedPartUrls(
    @Req() req: Request & { user?: { id?: string; userId?: string } },
    @Param('uploadSessionId') uploadSessionId: string,
    @Body() dto: GetPartUrlsDto,
  ) {
    return this.sharedFilesService.generateSharedPartUrls(
      this.getUserId(req),
      uploadSessionId,
      dto.partNumbers,
    );
  }

  @Post('multipart/:uploadSessionId/complete')
  @UseGuards(JwtAuthGuard)
  async completeSharedMultipartUpload(
    @Req() req: Request & { user?: { id?: string; userId?: string } },
    @Param('uploadSessionId') uploadSessionId: string,
    @Body() dto: CompleteMultipartUploadDto,
  ) {
    return this.sharedFilesService.completeSharedMultipartUpload(
      this.getUserId(req),
      uploadSessionId,
      dto.parts,
      this.getClientIp(req),
      this.getUserAgent(req),
    );
  }
}
