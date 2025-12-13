import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentAdmin } from '../auth/admin.decorator';
import { AdminSalesService } from './admin-sales.service';
import { AdminRole, PurchaseStatus } from '@prisma/client';

@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin/sales')
export class AdminSalesController {
  constructor(private readonly salesService: AdminSalesService) {}

  @Get()
  @Roles('READ_ONLY')
  listPurchases(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: PurchaseStatus,
    @Query('productCode') productCode?: string,
    @Query('userId') userId?: string,
    @Query('groupId') groupId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.salesService.listPurchases({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      productCode,
      userId,
      groupId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('stats')
  @Roles('READ_ONLY')
  getSalesStats(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.salesService.getSalesStats({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get(':id')
  @Roles('READ_ONLY')
  getPurchase(@Param('id') id: string) {
    return this.salesService.getPurchase(id);
  }

  @Patch(':id/reviewed')
  @Roles('SUPPORT')
  markReviewed(
    @Param('id') id: string,
    @Body() body: { note: string },
    @CurrentAdmin() admin: { id: string; role: AdminRole },
    @Req() req: any,
  ) {
    return this.salesService.markReviewed(
      id,
      body.note,
      admin,
      req.ip,
      req.headers['user-agent'],
    );
  }
}


