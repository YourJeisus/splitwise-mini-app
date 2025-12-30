import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

export interface AdminJwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateAdmin(email: string, password: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email },
    });
    if (!admin || !admin.enabled) {
      throw new UnauthorizedException('Неверные учётные данные');
    }
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Неверные учётные данные');
    }
    return admin;
  }

  async login(email: string, password: string) {
    const admin = await this.validateAdmin(email, password);
    const payload: AdminJwtPayload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
    };
  }

  async getMe(adminId: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, role: true, enabled: true },
    });
    if (!admin || !admin.enabled) {
      throw new UnauthorizedException('Пользователь не найден');
    }
    return admin;
  }

  async createAdmin(email: string, password: string, role: 'OWNER' | 'ADMIN' | 'SUPPORT' | 'READ_ONLY') {
    const hash = await bcrypt.hash(password, 10);
    return this.prisma.adminUser.create({
      data: {
        email,
        passwordHash: hash,
        role,
      },
      select: { id: true, email: true, role: true },
    });
  }
}









