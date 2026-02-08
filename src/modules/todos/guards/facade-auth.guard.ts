import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthFacade } from '../../authentication/auth.facade';

@Injectable()
export class FacadeAuthGuard implements CanActivate {
  constructor(private authFacade: AuthFacade) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    if (!authHeader) throw new UnauthorizedException('No token provided');

    const token = authHeader.split(' ')[1];
    if (!token) throw new UnauthorizedException('No token provided');

    const payload = await this.authFacade.validateToken(token);
    request.user = { userId: payload.sub, email: payload.email };
    return true;
  }
}
