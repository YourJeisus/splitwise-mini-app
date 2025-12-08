import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TelegramAuthGuard } from './telegram.guard';

@Module({
  providers: [AuthService, TelegramAuthGuard],
  controllers: [AuthController],
  exports: [AuthService, TelegramAuthGuard]
})
export class AuthModule {}

