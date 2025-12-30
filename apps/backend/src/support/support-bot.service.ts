import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Telegraf } from "telegraf";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SupportBotService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf | null = null;
  private readonly logger = new Logger(SupportBotService.name);
  private readonly isProd: boolean;
  private readonly webhookUrl: string | null;
  private readonly webhookPath = "/support-bot/webhook";
  private supportService: any;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    @Inject(forwardRef(() => require("./support.service").SupportService))
    supportServiceRef: any
  ) {
    this.supportService = supportServiceRef;
    const isDev = this.configService.get<string>("NODE_ENV") === "development";
    this.isProd = this.configService.get<string>("NODE_ENV") === "production";
    const token =
      (isDev && this.configService.get<string>("SUPPORT_BOT_TOKEN_DEV")) ||
      this.configService.get<string>("SUPPORT_BOT_TOKEN");

    if (token) {
      this.bot = new Telegraf(token);
    } else {
      this.logger.warn("SUPPORT_BOT_TOKEN not defined, support bot disabled");
    }

    const explicitWebhookUrl = this.configService.get<string>("WEBHOOK_URL");
    const railwayDomain = this.configService.get<string>("RAILWAY_PUBLIC_DOMAIN");
    this.webhookUrl = explicitWebhookUrl || (railwayDomain ? `https://${railwayDomain}` : null);
  }

  async onModuleInit() {
    if (!this.bot) return;
    this.setupHandlers();
    
    if (this.isProd && this.webhookUrl) {
      const url = `${this.webhookUrl.replace(/\/$/, "")}${this.webhookPath}`;
      try {
        await this.bot.telegram.setWebhook(url);
        this.logger.log(`Support bot webhook enabled: ${url}`);
      } catch (error) {
        this.logger.error("Failed to set support bot webhook", (error as Error).message);
      }
    } else {
      try {
        await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
      } catch {
        // ignore
      }
      this.bot.launch().catch(err => this.logger.error("Support bot failed to launch", err));
      this.logger.log("Support bot polling launching...");
    }
  }

  async onModuleDestroy() {
    if (this.bot) this.bot.stop("SIGTERM");
  }

  async handleUpdate(update: any) {
    if (!this.bot) return;
    await this.bot.handleUpdate(update);
  }

  async sendMessage(chatId: string, text: string, extra?: any) {
    if (!this.bot) return;
    try {
      return await this.bot.telegram.sendMessage(chatId, text, extra);
    } catch (e) {
      this.logger.error(`Failed to send message to ${chatId}`, e);
    }
  }

  private setupHandlers() {
    if (!this.bot) return;

    this.bot.start((ctx) => 
      ctx.reply("🛠 Добро пожаловать в поддержку ПОПОЛАМ!\n\nОпишите вашу проблему или вопрос, и мы поможем вам в ближайшее время.")
    );

    this.bot.help((ctx) =>
      ctx.reply("📌 Команды:\n/start — Начать общение с поддержкой\n/help — Показать справку\n\nПросто напишите ваш вопрос текстом, и мы ответим.")
    );

    this.bot.command("admin_link", async (ctx) => {
      const token = ctx.message.text.split(" ")[1];
      if (!token) {
        return ctx.reply("❌ Пожалуйста, укажите токен: /admin_link <TOKEN>");
      }

      const res = await this.supportService.linkAdminTelegram(
        token,
        String(ctx.from.id),
        String(ctx.chat.id)
      );

      if (res.success) {
        return ctx.reply(
          `✅ Успешно! Вы привязали Telegram к админ-аккаунту ${res.adminEmail}.\n\nТеперь вы будете получать уведомления о новых обращениях в поддержку.`
        );
      } else {
        return ctx.reply(`❌ Ошибка: ${res.message}`);
      }
    });

    this.bot.on("message", async (ctx: any) => {
      if (ctx.chat.type !== "private") return;
      if (!ctx.message.text) return;
      if (ctx.message.text.startsWith("/")) return;

      try {
        const telegramId = String(ctx.from.id);
        
        // Upsert user напрямую здесь, чтобы избежать циклической зависимости при инициализации
        const user = await this.prisma.user.upsert({
          where: { telegramId },
          update: {
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name,
            username: ctx.from.username,
          },
          create: {
            telegramId,
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name,
            username: ctx.from.username,
          },
        });

        // Найти или создать тикет
        let ticket = await this.prisma.supportTicket.findFirst({
          where: { userId: user.id, status: "OPEN" },
        });

        if (!ticket) {
          ticket = await this.prisma.supportTicket.create({
            data: { userId: user.id, status: "OPEN" },
          });
        }

        // Добавить сообщение
        await this.prisma.supportMessage.create({
          data: {
            ticketId: ticket.id,
            direction: "USER",
            text: ctx.message.text,
            telegramMessageId: String(ctx.message.message_id),
          },
        });

        await this.prisma.supportTicket.update({
          where: { id: ticket.id },
          data: { lastMessageAt: new Date() },
        });

        // Уведомить админов
        const admins = await this.prisma.adminUser.findMany({
          where: {
            enabled: true,
            role: { in: ["OWNER", "ADMIN", "SUPPORT"] },
            supportNotificationsEnabled: true,
          },
        });

        for (const admin of admins) {
          await this.prisma.adminNotification.create({
            data: {
              adminId: admin.id,
              type: "NEW_SUPPORT_MESSAGE",
              data: {
                ticketId: ticket.id,
                userFirstName: user.firstName,
                text: ctx.message.text.slice(0, 100),
              },
            },
          });

          if (admin.telegramChatId) {
            const userName = user.firstName || "Пользователь";
            const msg = `📬 Новое сообщение в поддержку от ${userName} (@${user.username || user.telegramId}):\n\n${ctx.message.text.slice(0, 200)}${ctx.message.text.length > 200 ? "..." : ""}`;
            
            await this.sendMessage(admin.telegramChatId, msg, {
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

        await ctx.reply("✅ Ваше сообщение отправлено в поддержку. Мы ответим в ближайшее время.");
      } catch (e) {
        this.logger.error("Failed to process support message", e);
        await ctx.reply("⚠️ Произошла ошибка. Попробуйте позже.");
      }
    });
  }
}

