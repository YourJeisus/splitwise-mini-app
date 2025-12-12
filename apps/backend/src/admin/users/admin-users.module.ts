import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuditModule } from '../audit/admin-audit.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [PrismaModule, AdminAuditModule, AdminAuthModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
  exports: [AdminUsersService],
})
export class AdminUsersModule {}

