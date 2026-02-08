import { Controller, Get, Query, UseGuards, Post, Body, BadRequestException } from '@nestjs/common';
import { TagsService } from './tags.service';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags, ApiBody } from '@nestjs/swagger';

@ApiTags('tags')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @ApiOperation({ summary: 'Search tags' })
  @ApiQuery({ name: 'search', required: false })
  async findAll(@Query('search') search?: string) {
    return this.tagsService.findAll(search);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new tag' })
  @ApiBody({ schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } })
  async create(@Body() body: { name: string }) {
    if (!body.name) throw new BadRequestException('Tag name is required');
    return this.tagsService.create(body.name);
  }
}
