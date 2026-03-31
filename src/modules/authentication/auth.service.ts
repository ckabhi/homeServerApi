import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto, LoginDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { EventsGateway } from '../events/events.gateway';
import { v7 as uuidv7 } from 'uuid';
import { parseDeviceInfo } from './helpers/parseDeviceInfo.helper';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private eventsGateway: EventsGateway,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already exists');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
      },
    });

    const tokens = this.generateTokens(user.id, user.email);
    return {email:user.email, tokens}
  }

  async login(dto: LoginDto, userAgent: string, ipAddress: string): Promise<{email:string, tokens:{accessToken:string, refreshToken:string}, sessionId:string}> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    const {refreshToken, accessToken, sessionId} = await this.generateTokens(user.id, user.email, undefined);
    const deviceInfo = parseDeviceInfo(userAgent);
    await this.createSession(user.id, refreshToken, deviceInfo.name, deviceInfo.deviceType, ipAddress, sessionId);


    // Notify other sessions potentially
    this.eventsGateway.emitToUser(user.id, 'auth.new_device_login', { 
        device: deviceInfo.name,
        ip: ipAddress,
        timestamp: new Date()
    });
    
    return {email:user.email, tokens:{accessToken, refreshToken}, sessionId:sessionId};
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
      const session = await this.prisma.session.findFirst({
        where: { refreshToken: refreshToken, userId: payload.sub },
      });

      if (!session || !session.isActive) throw new UnauthorizedException('Invalid session');

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException('User not found');

      // Rotate refresh token? For now just return new access token.
      // Usually good practice to rotate refresh token too.
      // Let's keep it simple as per requirements (1.2), but updating last active is good.
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastActiveAt: new Date() }
      });

      const accessToken = this.jwtService.sign(
        { sub: user.id, email: user.email, sessionId: session.sessionId },
        { secret: process.env.JWT_SECRET, expiresIn: process.env.JWT_EXPIRATION as any },
      );

      return { accessToken, refreshToken }; // Return same refresh token or rotate
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getUserData(userId: string, sessionId: string) {
    const [user, session] = await Promise.all([this.prisma.user.findUnique({where:{id: userId}}), this.getSessions(userId)]);
    if (!user) throw new UnauthorizedException('User not found');
    return {email:user.email, sessions:session, sessionId: sessionId };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  // Helper methods
  private async generateTokens(userId: string, email: string, sessionId?: string) {
    
    const newSessionId = sessionId || uuidv7();
const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ sub: userId, email, sessionId: newSessionId }, { secret: process.env.JWT_SECRET, expiresIn: process.env.JWT_EXPIRATION as any }),
      this.jwtService.signAsync({ sub: userId, email, sessionId: newSessionId }, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: process.env.JWT_REFRESH_EXPIRATION as any }),
    ]);
    return { accessToken, refreshToken, sessionId: newSessionId };
    
    
  }

  private async createSession(userId: string, refreshToken: string, userAgent: string, deviceType: string, ipAddress: string, sessionId: string) {
    const sessionData = await this.prisma.session.create({
      data: {
        userId,
        refreshToken,
        userAgent,
        deviceType,
        ipAddress,
        sessionId,  
      },  
    });
    return sessionData;
  }
  
  async getSessions(userId: string) {
    return this.prisma.session.findMany({ where: { userId, isActive: true }, select:{sessionId: true, userAgent: true, createdAt: true, lastActiveAt: true} });
  }

  async logout(userId: string,currentSessionId: string, sessionId?: string) {
    if (sessionId) {
      await this.prisma.session.updateMany({ where: { sessionId: sessionId , isActive: true}, data: { isActive: false } });
      return {message: "Logout successfully", sessionId: sessionId}
    } else {
      await this.prisma.session.updateMany({ where: { userId, sessionId: {not: currentSessionId} }, data: { isActive: false } });
      return {message: "Logout successfully", sessionId: "all"}
    }
  }
}
