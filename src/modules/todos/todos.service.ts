import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTodoDto, UpdateTodoDto } from './dto/todo.dto';
import { EventsGateway } from '../events/events.gateway';
import { Prisma } from '@prisma/client';

@Injectable()
export class TodosService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway
  ) {}

  async create(userId: string, dto: CreateTodoDto) {
    const maxOrder = await this.prisma.todo.findFirst({
      where: { userId },
      orderBy: { order: 'desc' },
    });
    const order = maxOrder ? maxOrder.order + 1 : 0;

    const todo = await this.prisma.todo.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        status: dto.status || 'new',
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        color: dto.color,
        isImportant: dto.isImportant,
        isRecurring: dto.isRecurring,
        order,
        tags: dto.tags
          ? {
              create: dto.tags.map((name) => ({
                tag: {
                  connectOrCreate: {
                    where: { name },
                    create: { name },
                  },
                },
              })),
            }
          : undefined,
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    const formattedTodo = this.mapTodo(todo);
    this.eventsGateway.emitToUser(userId, 'todo.created', formattedTodo);
    return formattedTodo;
  }

  async findAll(userId: string, filters: { month?: string; search?: string; tags?: string[] }) {
    const where: Prisma.TodoWhereInput = { userId };

    if (filters.month) {
        const [year, month] = filters.month.split('-').map(Number);
        if (year && month) {
            const startOfMonth = new Date(year, month - 1, 1);
            const endOfMonth = new Date(year, month, 0, 23, 59, 59);
            where.createdAt = {
                gte: startOfMonth,
                lte: endOfMonth
            };
        }
    }

    if (filters.search) {
        where.OR = [
            { title: { contains: filters.search } },
            { description: { contains: filters.search } }
        ];
    }

    if (filters.tags && filters.tags.length > 0) {
        where.tags = {
          some: {
            tag: {
              name: { in: filters.tags }
            }
          }
        };
    }

    const todos = await this.prisma.todo.findMany({
      where,
      orderBy: { order: 'asc' },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    return todos.map(todo => this.mapTodo(todo));
  }

  async findOne(userId: string, id: string) {
    const todo = await this.prisma.todo.findFirst({ 
      where: { id, userId },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });
    if (!todo) throw new NotFoundException('Todo not found');
    return this.mapTodo(todo);
  }

  async update(userId: string, id: string, dto: UpdateTodoDto) {
    await this.findOne(userId, id); // check existence

    const updated = await this.prisma.todo.update({
      where: { id },
      data: {
          title: dto.title,
          description: dto.description,
          status: dto.status,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          color: dto.color,
          isImportant: dto.isImportant,
          ...(dto.completed !== undefined ? { status: dto.completed ? 'completed' : 'active' } : {}),
          tags: dto.tags ? {
             deleteMany: {}, // Explicitly clear existing mappings
             create: dto.tags.map(name => ({
                 tag: {
                     connectOrCreate: {
                         where: { name },
                         create: { name }
                     }
                 }
             }))
          } : undefined
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });
    
    const formattedTodo = this.mapTodo(updated);
    this.eventsGateway.emitToUser(userId, 'todo.updated', formattedTodo);
    return formattedTodo;
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id); // check existence
    const deleted = await this.prisma.todo.delete({ where: { id } });
    this.eventsGateway.emitToUser(userId, 'todo.deleted', { id });
    return deleted;
  }

  async bulkDelete(userId: string, ids: string[]) {
      const result = await this.prisma.todo.deleteMany({
          where: {
              userId,
              id: { in: ids }
          }
      });
      this.eventsGateway.emitToUser(userId, 'todo.bulk_deleted', { ids });
      return result;
  }

  async bulkComplete(userId: string, ids: string[]) {
      const result = await this.prisma.todo.updateMany({
          where: {
              userId,
              id: { in: ids }
          },
          data: {
              status: 'completed'
          }
      });
      this.eventsGateway.emitToUser(userId, 'todo.bulk_updated', { ids, status: 'completed' });
      return result;
  }

  async reorder(userId: string, ids: string[]) {
      const updates = ids.map((id, index) => 
          this.prisma.todo.update({
              where: { id, userId },
              data: { order: index }
          })
      );
      await this.prisma.$transaction(updates);
      this.eventsGateway.emitToUser(userId, 'todo.reordered', { ids });
      return { success: true };
  }

  private mapTodo(todo: any) {
    return {
      ...todo,
      tags: todo.tags ? todo.tags.map((tt: any) => tt.tag.name) : [],
    };
  }
}
