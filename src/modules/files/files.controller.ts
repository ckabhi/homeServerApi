import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Param,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { GenerateUploadUrlDto } from './dto/generate-upload-url.dto';
import { GenerateDownloadUrlDto } from './dto/generate-download-url.dto';
import { ListFolderContentsDto } from './dto/list-folder-contents.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

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

  @Get('bucket-tree')
  async getBucketTree(
    @Req() req: Request & { user?: { id?: string; userId?: string } },
  ) {
    return this.filesService.getBucketTree(this.getUserId(req));
  }
}
