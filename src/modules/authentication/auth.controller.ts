import { Controller, Post, Body, Req, Get, UseGuards, Ip, Delete, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: any, @Ip() ip: string) {
    const userAgent = req.headers['user-agent'] || 'unknown';
    return this.authService.login(dto, userAgent, ip);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
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
    return this.authService.logout(req.user.userId,req.user.sessionId, sessionId);
  }
}
