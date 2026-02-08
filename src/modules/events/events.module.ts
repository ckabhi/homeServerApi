import { Module, Global } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { JwtModule } from '@nestjs/jwt';

@Global()
@Module({
  imports: [JwtModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
