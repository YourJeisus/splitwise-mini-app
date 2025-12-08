import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { extractTelegramUser, isValidTelegramInitData } from './telegram.util';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async verify(initData: string) {
    const botToken = this.config.get<string>('BOT_TOKEN');
    if (!botToken) {
      throw new UnauthorizedException('BOT_TOKEN not configured');
    }

    const userPayload = extractTelegramUser(initData);
    if (!userPayload?.id) {
      throw new UnauthorizedException('Telegram user missing');
    }

    const isValid = isValidTelegramInitData(initData, botToken);
    if (!isValid) {
      throw new UnauthorizedException('Invalid Telegram signature');
    }

    const telegramId = String(userPayload.id);
    const user = await this.prisma.user.upsert({
      where: { telegramId },
      update: {
        firstName: userPayload.first_name,
        lastName: userPayload.last_name,
        username: userPayload.username,
        avatarUrl: userPayload.photo_url
      },
      create: {
        telegramId,
        firstName: userPayload.first_name,
        lastName: userPayload.last_name,
        username: userPayload.username,
        avatarUrl: userPayload.photo_url
      }
    });

    return user;
  }
}

