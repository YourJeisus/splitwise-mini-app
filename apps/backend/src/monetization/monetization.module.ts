import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { MonetizationController } from "./monetization.controller";
import { MonetizationService } from "./monetization.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MonetizationController],
  providers: [MonetizationService],
  exports: [MonetizationService],
})
export class MonetizationModule {}


