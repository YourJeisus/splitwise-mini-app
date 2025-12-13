import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { AdminGroupsController } from './admin-groups.controller';
import { AdminGroupsService } from './admin-groups.service';

@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [AdminGroupsController],
  providers: [AdminGroupsService],
  exports: [AdminGroupsService],
})
export class AdminGroupsModule {}


