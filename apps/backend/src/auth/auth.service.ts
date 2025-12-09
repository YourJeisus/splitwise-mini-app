import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { extractTelegramUser, isValidTelegramInitData } from "./telegram.util";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async verify(initData: string) {
    const botToken = this.config.get<string>("BOT_TOKEN");
    const isDev = this.config.get<string>("NODE_ENV") === "development";

    // Dev mode: если initData начинается с "dev_", обходим проверку
    if (isDev && initData.startsWith("dev_")) {
      const devUserId = initData.replace("dev_", "") || "123456789";
      const devUsers: Record<
        string,
        { firstName: string; lastName: string; username: string }
      > = {
        "111": { firstName: "Алекс", lastName: "Петров", username: "alex" },
        "222": { firstName: "Мария", lastName: "Иванова", username: "maria" },
        "333": { firstName: "Иван", lastName: "Сидоров", username: "ivan" },
      };
      const devData = devUsers[devUserId] || {
        firstName: "Dev",
        lastName: "User",
        username: "devuser",
      };
      const user = await this.prisma.user.upsert({
        where: { telegramId: devUserId },
        update: devData,
        create: {
          telegramId: devUserId,
          ...devData,
        },
      });
      return user;
    }

    if (!botToken) {
      throw new UnauthorizedException("BOT_TOKEN not configured");
    }

    const userPayload = extractTelegramUser(initData);
    if (!userPayload?.id) {
      throw new UnauthorizedException("Telegram user missing");
    }

    const isValid = isValidTelegramInitData(initData, botToken);
    if (!isValid) {
      throw new UnauthorizedException("Invalid Telegram signature");
    }

    const telegramId = String(userPayload.id);
    const user = await this.prisma.user.upsert({
      where: { telegramId },
      update: {
        firstName: userPayload.first_name,
        lastName: userPayload.last_name,
        username: userPayload.username,
        avatarUrl: userPayload.photo_url,
      },
      create: {
        telegramId,
        firstName: userPayload.first_name,
        lastName: userPayload.last_name,
        username: userPayload.username,
        avatarUrl: userPayload.photo_url,
      },
    });

    return user;
  }
}
