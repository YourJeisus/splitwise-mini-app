import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuditModule } from '../audit/admin-audit.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminSalesController } from './admin-sales.controller';
import { AdminSalesService } from './admin-sales.service';

@Module({
  imports: [PrismaModule, AdminAuditModule, AdminAuthModule],
  controllers: [AdminSalesController],
  providers: [AdminSalesService],
  exports: [AdminSalesService],
})
export class AdminSalesModule {}









