import { Module } from "@nestjs/common";
import { AdminSupportController } from "./admin-support.controller";
import { SupportModule } from "../../support/support.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { AdminAuthModule } from "../auth/admin-auth.module";

@Module({
  imports: [PrismaModule, SupportModule, AdminAuthModule],
  controllers: [AdminSupportController],
})
export class AdminSupportModule {}

