import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/authentication/auth.module';
import { TodosModule } from './modules/todos/todos.module';
import { EventsModule } from './modules/events/events.module';
import { TagsModule } from './modules/tags/tags.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, TodosModule, EventsModule, TagsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
