import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthFacade } from './auth.facade';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({}), // We handle secrets in Service manually or here? 
    // Actually typically we register options here, but since we have two secrets (access/refresh),
    // we might just use JwtService.sign directly with specific secrets in the service. 
    // But JwtStrategy needs one.
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AuthFacade],
  exports: [AuthFacade, AuthService, JwtModule],
})
export class AuthModule {}
