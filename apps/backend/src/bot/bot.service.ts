import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Telegraf, Markup } from "telegraf";

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf;
  private readonly logger = new Logger(BotService.name);
  private readonly webAppUrl: string;

  constructor(private configService: ConfigService) {
    const token = this.configService.get<string>("BOT_TOKEN");
    if (!token) {
      throw new Error("BOT_TOKEN is not defined");
    }
    this.bot = new Telegraf(token);
    this.webAppUrl =
      this.configService.get<string>("WEBAPP_URL") ||
      "https://splitwise.up.railway.app";
  }

  async onModuleInit() {
    this.setupHandlers();
    await this.bot.launch();
    this.logger.log("Bot started");
  }

  async onModuleDestroy() {
    this.bot.stop("SIGTERM");
  }

  private setupHandlers() {
    this.bot.start((ctx) => {
      const firstName = ctx.from?.first_name || "друг";
      return ctx.reply(
        `👋 Привет, ${firstName}!\n\nДобро пожаловать в ПОПОЛАМ — приложение, которое считает всё за вас и сохраняет дружбу.\n\nНажми кнопку ниже, чтобы открыть приложение:`,
        Markup.inlineKeyboard([
          Markup.button.webApp("📱 Открыть SplitWise", this.webAppUrl),
        ])
      );
    });

    this.bot.help((ctx) => {
      return ctx.reply(
        "📌 Команды:\n/start — Начать и открыть приложение\n/help — Показать справку\n/app — Открыть приложение",
        Markup.inlineKeyboard([
          Markup.button.webApp("📱 Открыть SplitWise", this.webAppUrl),
        ])
      );
    });

    this.bot.command("app", (ctx) => {
      return ctx.reply(
        "Нажми кнопку, чтобы открыть приложение:",
        Markup.inlineKeyboard([
          Markup.button.webApp("📱 Открыть SplitWise", this.webAppUrl),
        ])
      );
    });
  }
}
