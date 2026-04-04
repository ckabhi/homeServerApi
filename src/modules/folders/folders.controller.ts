import {
  Controller,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { FoldersService } from './folders.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { CreateFolderDto } from './dto/create-folder.dto';
import { RenameFolderDto } from './dto/rename-folder.dto';

@Controller('folders')
@UseGuards(JwtAuthGuard)
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  private getUserId(req: { user?: { id?: string; userId?: string } }): string {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Invalid token payload: user id missing');
    }
    return userId;
  }

  @Post()
  async createFolder(@Req() req: any, @Body() dto: CreateFolderDto) {
    return this.foldersService.createFolder(this.getUserId(req), dto);
  }

  @Delete(':folderId')
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

  @Patch(':folderId/rename')
  async renameFolder(
    @Req() req: any,
    @Param('folderId') folderId: string,
    @Body() dto: RenameFolderDto,
  ) {
    return this.foldersService.renameFolder(this.getUserId(req), folderId, dto);
  }
}
