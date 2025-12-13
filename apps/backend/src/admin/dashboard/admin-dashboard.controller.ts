import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminDashboardService } from './admin-dashboard.service';

@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Get('kpi')
  @Roles('READ_ONLY')
  getKPI(@Query('period') period?: string) {
    const validPeriod = ['today', '7d', '30d'].includes(period || '') ? period as 'today' | '7d' | '30d' : '7d';
    return this.dashboardService.getKPI(validPeriod);
  }
}


