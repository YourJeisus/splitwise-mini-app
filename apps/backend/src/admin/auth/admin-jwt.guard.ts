import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminJwtPayload } from './admin-auth.service';

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Требуется авторизация');
    }

    const token = authHeader.slice(7);
    let payload: AdminJwtPayload;
    try {
      payload = this.jwtService.verify<AdminJwtPayload>(token, {
        secret: this.config.get<string>('ADMIN_JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Недействительный токен');
    }

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, enabled: true },
    });
    if (!admin || !admin.enabled) {
      throw new UnauthorizedException('Пользователь отключён');
    }

    request.admin = admin;
    return true;
  }
}

