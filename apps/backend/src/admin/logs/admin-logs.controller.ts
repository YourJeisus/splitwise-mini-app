import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminAuditService } from '../audit/admin-audit.service';

@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin/logs')
export class AdminLogsController {
  constructor(private readonly auditService: AdminAuditService) {}

  @Get()
  @Roles('ADMIN')
  listLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('adminId') adminId?: string,
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
  ) {
    return this.auditService.list({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      adminId,
      targetType,
      targetId,
    });
  }
}

