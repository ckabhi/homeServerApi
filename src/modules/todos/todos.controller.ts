import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { TodosService } from './todos.service';
import { CreateTodoDto, UpdateTodoDto, BulkDeleteDto, BulkCompleteDto, ReorderTodoDto } from './dto/todo.dto';
import { FacadeAuthGuard } from './guards/facade-auth.guard';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';

@ApiTags('todos')
@ApiBearerAuth()
@UseGuards(FacadeAuthGuard)
@Controller('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Post()
  create(@Req() req, @Body() createTodoDto: CreateTodoDto) {
    return this.todosService.create(req.user.userId, createTodoDto);
  }

  @Get()
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'tags', required: false, isArray: true, type: String })
  findAll(
    @Req() req,
    @Query('month') month?: string,
    @Query('search') search?: string,
    @Query('tags') tags?: string[]
  ) {
    const tagArray = tags ? (Array.isArray(tags) ? tags : [tags]) : undefined;
    return this.todosService.findAll(req.user.userId, { month, search, tags: tagArray });
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.todosService.findOne(req.user.userId, id);
  }

  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() updateTodoDto: UpdateTodoDto) {
    return this.todosService.update(req.user.userId, id, updateTodoDto);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.todosService.remove(req.user.userId, id);
  }

  @Post('bulk-delete')
  @ApiBody({ type: BulkDeleteDto })
  bulkDelete(@Req() req, @Body() dto: BulkDeleteDto) {
      return this.todosService.bulkDelete(req.user.userId, dto.ids);
  }

  @Post('bulk-complete')
  @ApiBody({ type: BulkCompleteDto })
  bulkComplete(@Req() req, @Body() dto: BulkCompleteDto) {
      return this.todosService.bulkComplete(req.user.userId, dto.ids);
  }

  @Post('reorder')
  @ApiBody({ type: ReorderTodoDto })
  reorder(@Req() req, @Body() dto: ReorderTodoDto) {
      if (dto.order) {
          return this.todosService.reorder(req.user.userId, dto.order);
      }
      if (dto.items) {
          const sortedIds = dto.items.sort((a, b) => a.order - b.order).map(i => i.id);
          return this.todosService.reorder(req.user.userId, sortedIds);
      }
      return { message: 'No order provided' };
  }
}
