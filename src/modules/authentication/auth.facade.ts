import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthFacade {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService
  ) {}

  async validateToken(token: string): Promise<any> {
    try {
      const payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
      return payload;
    } catch(e) {
      throw new UnauthorizedException('Invalid token');
    }
  }
  
  async validateUser(userId: string) {
      return this.authService.validateUser(userId);
  }
}
