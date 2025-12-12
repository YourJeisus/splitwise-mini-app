import { Body, Controller, Get, Post } from "@nestjs/common";
import { BotService } from "./bot/bot.service";

@Controller()
export class AppController {
  constructor(private readonly botService: BotService) {}

  @Get('/health')
  getHealth() {
    return { status: 'ok' };
  }

  @Post("/bot/webhook")
  async botWebhook(@Body() update: any) {
    await this.botService.handleWebhookUpdate(update);
    return { ok: true };
  }
}

