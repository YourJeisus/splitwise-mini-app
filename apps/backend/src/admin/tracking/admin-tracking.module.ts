import { Module } from "@nestjs/common";
import { AdminTrackingController } from "./admin-tracking.controller";
import { AdminTrackingService } from "./admin-tracking.service";
import { PrismaModule } from "../../prisma/prisma.module";
import { AdminAuditModule } from "../audit/admin-audit.module";
import { AdminAuthModule } from "../auth/admin-auth.module";

@Module({
  imports: [PrismaModule, AdminAuditModule, AdminAuthModule],
  controllers: [AdminTrackingController],
  providers: [AdminTrackingService],
  exports: [AdminTrackingService],
})
export class AdminTrackingModule {}
