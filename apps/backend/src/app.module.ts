import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { GroupsModule } from "./groups/groups.module";
import { ExpensesModule } from "./expenses/expenses.module";
import { SettlementsModule } from "./settlements/settlements.module";
import { PrismaModule } from "./prisma/prisma.module";
import { BotModule } from "./bot/bot.module";
import { UploadModule } from "./upload/upload.module";
import { MonetizationModule } from "./monetization/monetization.module";
import { AdminModule } from "./admin/admin.module";
import { SupportModule } from "./support/support.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UploadModule,
    AuthModule,
    UsersModule,
    GroupsModule,
    ExpensesModule,
    SettlementsModule,
    MonetizationModule,
    BotModule,
    AdminModule,
    SupportModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
