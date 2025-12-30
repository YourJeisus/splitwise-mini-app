import { Module } from '@nestjs/common';
import { AdminAuditModule } from '../audit/admin-audit.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminLogsController } from './admin-logs.controller';

@Module({
  imports: [AdminAuditModule, AdminAuthModule],
  controllers: [AdminLogsController],
})
export class AdminLogsModule {}









