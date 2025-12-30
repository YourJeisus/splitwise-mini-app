import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SupportBotService } from "./support-bot.service";
import { MessageDirection, SupportStatus, AdminRole } from "@prisma/client";

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private prisma: PrismaService,
    private supportBotService: SupportBotService
  ) {}

  async ensureUserFromTelegram(tgUser: { id: number; first_name?: string; last_name?: string; username?: string }) {
    const telegramId = String(tgUser.id);
    return this.prisma.user.upsert({
      where: { telegramId },
      update: {
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        username: tgUser.username,
      },
      create: {
        telegramId,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        username: tgUser.username,
      },
    });
  }

  async openOrGetTicket(userId: string) {
    let ticket = await this.prisma.supportTicket.findFirst({
      where: { userId, status: SupportStatus.OPEN },
      orderBy: { createdAt: "desc" },
    });

    if (!ticket) {
      ticket = await this.prisma.supportTicket.create({
        data: { userId, status: SupportStatus.OPEN },
      });
    }

    return ticket;
  }

  async addUserMessage(ticketId: string, text: string, telegramMessageId?: number) {
    const message = await this.prisma.supportMessage.create({
      data: {
        ticketId,
        direction: MessageDirection.USER,
        text,
        telegramMessageId: telegramMessageId ? String(telegramMessageId) : undefined,
      },
    });

    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { lastMessageAt: new Date() },
    });

    await this.notifyAdminsAboutNewMessage(ticketId, text);
    return message;
  }

  async addAdminMessage(ticketId: string, adminId: string, text: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: true },
    });

    if (!ticket) throw new Error("Ticket not found");

    const message = await this.prisma.supportMessage.create({
      data: {
        ticketId,
        direction: MessageDirection.ADMIN,
        text,
        adminId,
      },
    });

    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { lastMessageAt: new Date() },
    });

    // Отправка в Telegram пользователю
    await this.supportBotService.sendMessage(
      ticket.user.telegramId,
      `💬 Ответ от поддержки:\n\n${text}`
    );

    return message;
  }

  async assignTicket(ticketId: string, adminId: string | null) {
    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assignedAdminId: adminId },
    });
  }

  async setTicketStatus(ticketId: string, status: SupportStatus) {
    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status },
    });
  }

  private async notifyAdminsAboutNewMessage(ticketId: string, text: string) {
    const admins = await this.prisma.adminUser.findMany({
      where: {
        enabled: true,
        role: { in: [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.SUPPORT] },
        supportNotificationsEnabled: true,
      },
    });

    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: true },
    });

    for (const admin of admins) {
      // 1. Уведомление в БД (для админки)
      await this.prisma.adminNotification.create({
        data: {
          adminId: admin.id,
          type: "NEW_SUPPORT_MESSAGE",
          data: {
            ticketId,
            userFirstName: ticket?.user.firstName,
            text: text.slice(0, 100),
          },
        },
      });

      // 2. Уведомление в Telegram DM (если привязан)
      if (admin.telegramChatId) {
        const userName = ticket?.user.firstName || "Пользователь";
        const msg = `📬 Новое сообщение в поддержку от ${userName} (@${ticket?.user.username || ticket?.user.telegramId}):\n\n${text.slice(0, 200)}${text.length > 200 ? "..." : ""}`;
        
        await this.supportBotService.sendMessage(admin.telegramChatId, msg, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "👁 Открыть тикет в админке",
                  url: `${process.env.WEBAPP_URL || "https://popolam.up.railway.app"}/admin#support`,
                },
              ],
            ],
          },
        });
      }
    }
  }

  async generateLinkToken(adminId: string) {
    const token = Math.random().toString(36).slice(2, 10).toUpperCase();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    return this.prisma.adminTelegramLinkToken.create({
      data: {
        adminId,
        token,
        expiresAt,
      },
    });
  }

  async linkAdminTelegram(token: string, telegramUserId: string, telegramChatId: string) {
    const linkToken = await this.prisma.adminTelegramLinkToken.findUnique({
      where: { token },
      include: { admin: true },
    });

    if (!linkToken || linkToken.usedAt || linkToken.expiresAt < new Date()) {
      return { success: false, message: "Токен недействителен или просрочен" };
    }

    await this.prisma.adminUser.update({
      where: { id: linkToken.adminId },
      data: {
        telegramUserId,
        telegramChatId,
      },
    });

    await this.prisma.adminTelegramLinkToken.update({
      where: { id: linkToken.id },
      data: { usedAt: new Date() },
    });

    return { success: true, adminEmail: linkToken.admin.email };
  }
}

