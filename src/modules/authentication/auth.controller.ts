import {
  Controller,
  Post,
  Body,
  Req,
  Get,
  UseGuards,
  Ip,
  Delete,
  Query,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import express from 'express';
import ms, { StringValue } from 'ms';
import { ConfigService } from '@nestjs/config';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Req() req: any,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const userAgent = req.headers['user-agent'] || 'unknown';

    return this.authService
      .login(dto, userAgent, ip)
      .then(({ email, tokens, sessionId }) => {
        res.cookie('refreshToken', tokens.refreshToken, {
          path: '/api/v1/auth/refresh',
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: ms(
            (this.configService.get<string>('JWT_REFRESH_EXPIRATION') ||
              '7d') as StringValue,
          ),
        });
        return {
          email,
          tokens: { accessToken: tokens.accessToken },
          sessionId,
        };
      });
  }

  @Post('refresh')
  refresh(@Req() req: express.Request) {
    const token = req.cookies?.refreshToken;
    if (!token) {
      throw new Error('Refresh token not found in cookies');
    }
    return this.authService
      .refresh(token)
      .then(({ accessToken, refreshToken }) => {
        req.res?.cookie('refreshToken', refreshToken, {
          path: '/api/v1/auth/refresh',
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: ms(
            (this.configService.get<string>('JWT_REFRESH_EXPIRATION') ||
              '7d') as StringValue,
          ),
        });
        return { accessToken };
      });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getUser(@Req() req: any) {
    return this.authService.getUserData(req.user.userId, req.user.sessionId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  getSessions(@Req() req: any) {
    return this.authService.getSessions(req.user.userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('sessions')
  logout(@Req() req: any, @Query('sessionId') sessionId?: string) {
    return this.authService.logout(
      req.user.userId,
      req.user.sessionId,
      sessionId,
    );
  }
}
