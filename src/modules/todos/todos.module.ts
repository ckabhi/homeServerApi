import { Module } from '@nestjs/common';
import { TodosService } from './todos.service';
import { TodosController } from './todos.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../authentication/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TodosController],
  providers: [TodosService],
})
export class TodosModule {}
