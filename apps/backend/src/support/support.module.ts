import { Module } from "@nestjs/common";
import { SupportService } from "./support.service";
import { SupportBotService } from "./support-bot.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [SupportService, SupportBotService],
  exports: [SupportService, SupportBotService],
})
export class SupportModule {}

