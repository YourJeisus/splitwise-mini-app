import { Module } from "@nestjs/common";
import { BotService } from "./bot.service";
import { MonetizationModule } from "../monetization/monetization.module";

@Module({
  imports: [MonetizationModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
