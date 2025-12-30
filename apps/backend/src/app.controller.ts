import { Body, Controller, Get, Post } from "@nestjs/common";
import { BotService } from "./bot/bot.service";
import { SupportBotService } from "./support/support-bot.service";

@Controller()
export class AppController {
  constructor(
    private readonly botService: BotService,
    private readonly supportBotService: SupportBotService
  ) {}

  @Get('/health')
  getHealth() {
    return { status: 'ok' };
  }

  @Post("/bot/webhook")
  async botWebhook(@Body() update: any) {
    await this.botService.handleWebhookUpdate(update);
    return { ok: true };
  }

  @Post("/support-bot/webhook")
  async supportBotWebhook(@Body() update: any) {
    await this.supportBotService.handleUpdate(update);
    return { ok: true };
  }
}

