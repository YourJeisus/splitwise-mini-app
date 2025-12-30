import { Module } from "@nestjs/common";
import { AdminAuthModule } from "./auth/admin-auth.module";
import { AdminAuditModule } from "./audit/admin-audit.module";
import { AdminProductsModule } from "./products/admin-products.module";
import { AdminUsersModule } from "./users/admin-users.module";
import { AdminSalesModule } from "./sales/admin-sales.module";
import { AdminDashboardModule } from "./dashboard/admin-dashboard.module";
import { AdminGroupsModule } from "./groups/admin-groups.module";
import { AdminLogsModule } from "./logs/admin-logs.module";
import { AdminTrackingModule } from "./tracking/admin-tracking.module";
import { AdminSupportModule } from "./support/admin-support.module";

@Module({
  imports: [
    AdminAuthModule,
    AdminAuditModule,
    AdminProductsModule,
    AdminUsersModule,
    AdminSalesModule,
    AdminDashboardModule,
    AdminGroupsModule,
    AdminLogsModule,
    AdminTrackingModule,
    AdminSupportModule,
  ],
})
export class AdminModule {}
