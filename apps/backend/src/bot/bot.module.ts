import { Module } from "@nestjs/common";
import { BotService } from "./bot.service";
import { MonetizationModule } from "../monetization/monetization.module";
import { AdminTrackingModule } from "../admin/tracking/admin-tracking.module";

@Module({
  imports: [MonetizationModule, AdminTrackingModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
