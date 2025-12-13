import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuditModule } from '../audit/admin-audit.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminProductsController, AdminPromoCodesController } from './admin-products.controller';
import { AdminProductsService } from './admin-products.service';

@Module({
  imports: [PrismaModule, AdminAuditModule, AdminAuthModule],
  controllers: [AdminProductsController, AdminPromoCodesController],
  providers: [AdminProductsService],
  exports: [AdminProductsService],
})
export class AdminProductsModule {}


