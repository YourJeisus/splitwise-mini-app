import { Module } from "@nestjs/common";
import { ExpensesService } from "./expenses.service";
import { ExpensesController } from "./expenses.controller";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { OcrService } from "./services/ocr.service";

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [ExpensesService, OcrService],
  controllers: [ExpensesController],
})
export class ExpensesModule {}

