import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Telegraf, Markup } from "telegraf";
import { MonetizationService } from "../monetization/monetization.service";
import { AdminTrackingService } from "../admin/tracking/admin-tracking.service";

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf | null = null;
  private readonly logger = new Logger(BotService.name);
  private readonly webAppUrl: string;
  private readonly isProd: boolean;
  private readonly webhookUrl: string | null;
  private readonly webhookPath = "/bot/webhook";

  constructor(
    private configService: ConfigService,
    private monetizationService: MonetizationService,
    private trackingService: AdminTrackingService
  ) {
    const isDev = this.configService.get<string>("NODE_ENV") === "development";
    this.isProd = this.configService.get<string>("NODE_ENV") === "production";
    const isTestEnv =
      this.configService.get<string>("TELEGRAM_TEST_ENV") === "true";
    const token =
      (isDev && this.configService.get<string>("BOT_TOKEN_DEV")) ||
      this.configService.get<string>("BOT_TOKEN");
    if (token) {
      this.bot = new Telegraf(token, { telegram: { testEnv: isTestEnv } });
    } else {
      this.logger.warn("BOT_TOKEN is not defined, bot disabled");
    }
    this.webAppUrl =
      this.configService.get<string>("WEBAPP_URL") ||
      "https://popolam.up.railway.app";

    const explicitWebhookUrl = this.configService.get<string>("WEBHOOK_URL");
    const railwayDomain = this.configService.get<string>(
      "RAILWAY_PUBLIC_DOMAIN"
    );
    this.webhookUrl =
      explicitWebhookUrl || (railwayDomain ? `https://${railwayDomain}` : null);
  }

  async onModuleInit() {
    if (!this.bot) return;
    this.setupHandlers();
    if (this.isProd && this.webhookUrl) {
      const base = this.webhookUrl.replace(/\/$/, "");
      const url = `${base}${this.webhookPath}`;
      try {
        await this.bot.telegram.setWebhook(url);
        this.logger.log(`Bot webhook enabled: ${url}`);
      } catch (error) {
        this.logger.error("Failed to set webhook", (error as Error).message);
      }
      return;
    }

    // polling (dev/local)
    try {
      await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
    } catch {
      // ignore
    }
    this.bot.launch().catch((error) => {
      this.logger.error("Failed to start bot", (error as Error).message);
    });
    this.logger.log("Bot polling launching...");
  }

  async onModuleDestroy() {
    if (this.bot) {
      this.bot.stop("SIGTERM");
    }
  }

  async handleWebhookUpdate(update: any) {
    if (!this.bot) return;
    await this.bot.handleUpdate(update);
  }

  private setupHandlers() {
    if (!this.bot) return;

    this.bot.start(async (ctx) => {
      const firstName = ctx.from?.first_name || "друг";
      const telegramUserId = ctx.from?.id ? String(ctx.from.id) : undefined;

      // Обработка tracking параметра из start
      const startPayload =
        (ctx as any).startPayload || (ctx.message as any)?.text?.split(" ")[1];
      if (startPayload) {
        try {
          await this.trackingService.recordClick(startPayload, telegramUserId);
        } catch (e) {
          // ignore tracking errors
        }
      }

      return ctx.reply(
        `👋 Привет, ${firstName}!\n\nДобро пожаловать в ПОПОЛАМ — приложение, которое считает всё за вас и сохраняет дружбу.\n\nНажми кнопку ниже, чтобы открыть приложение:`,
        Markup.inlineKeyboard([
          Markup.button.webApp("📱 Открыть ПОПОЛАМ", this.webAppUrl),
        ])
      );
    });

    this.bot.help((ctx) => {
      return ctx.reply(
        "📌 Команды:\n/start — Начать и открыть приложение\n/help — Показать справку\n/app — Открыть приложение",
        Markup.inlineKeyboard([
          Markup.button.webApp("📱 Открыть ПОПОЛАМ", this.webAppUrl),
        ])
      );
    });

    this.bot.command("app", (ctx) => {
      return ctx.reply(
        "Нажми кнопку, чтобы открыть приложение:",
        Markup.inlineKeyboard([
          Markup.button.webApp("📱 Открыть ПОПОЛАМ", this.webAppUrl),
        ])
      );
    });

    this.bot.command("info", (ctx) => {
      return ctx.reply(
        [
          "Обычная версия (бесплатно)",
          "Доступно:",
          "• Создание групп и добавление участников",
          "• Ручной ввод трат",
          "• Деление расходов и базовый баланс группы",
          "• Умное сведение долгов (кто кому сколько)",
          "Ограничения:",
          "• Одна валюта на группу (валюта поездки)",
          "• Без мультивалютных трат",
          "• Без сканирования чеков",
          "• Без экспорта итогов",
          "• Без автоматических/нейтральных напоминаний",
          "• Закрытие поездки — вручную, без финального сценария",
          "",
          "Trip Pass (платно, на одну группу/поездку)",
          "Открывает:",
          "• Сканирование чеков (лимитировано)",
          "• Мультивалютные траты с конвертацией в валюту группы",
          "• Умное закрытие поездки одной кнопкой",
          "• Готовые инструкции переводов для каждого участника",
          "• Нейтральные шаблоны напоминаний должникам",
          "• Экспорт итогов поездки (PDF/CSV)",
          "• Опционально: разделение стоимости Trip Pass между всеми участниками как системная трата",
          "",
          "Где и когда показывать кнопку “Купить Trip Pass”",
          "Кнопка показывается только в контексте пользы:",
          "• При попытке сканировать чек",
          "• При добавлении траты в другой валюте",
          "• При нажатии “Завершить поездку / Посчитать итоги” (основной момент)",
          "• Мягко — при первом входе в новую группу",
          "",
          "Кнопка не показывается:",
          "• На главном экране приложения",
          "• При каждом входе в группу",
          "• До первой добавленной траты",
          "",
          "Trip Pass предлагается как способ быстро, корректно и без конфликтов закрыть поездку, а не как абстрактная подписка.",
        ].join("\n")
      );
    });

    this.bot.on("pre_checkout_query", async (ctx: any) => {
      try {
        const q = ctx.update?.pre_checkout_query;
        if (!q) return;
        const result = await this.monetizationService.validatePreCheckout({
          invoicePayload: q.invoice_payload,
          totalAmount: q.total_amount,
          currency: q.currency,
          fromTelegramUserId: q.from?.id,
        });
        await ctx.answerPreCheckoutQuery(
          result.ok,
          result.ok ? undefined : { error_message: result.errorMessage }
        );
      } catch (e) {
        await ctx.answerPreCheckoutQuery(false, {
          error_message: "Ошибка проверки оплаты",
        });
      }
    });

    this.bot.on("message", async (ctx: any) => {
      const sp = ctx.message?.successful_payment;
      if (!sp) return;
      try {
        await this.monetizationService.confirmSuccessfulPayment({
          invoicePayload: sp.invoice_payload,
          telegramPaymentChargeId: sp.telegram_payment_charge_id,
          totalAmount: sp.total_amount,
          currency: sp.currency,
          paidTelegramUserId: ctx.from?.id,
        });
        await ctx.reply(
          "✅ Оплата прошла",
          Markup.inlineKeyboard([
            Markup.button.webApp("📱 Открыть ПОПОЛАМ", this.webAppUrl),
          ])
        );
      } catch (e) {
        await ctx.reply("⚠️ Не удалось обработать оплату");
      }
    });
  }
}
