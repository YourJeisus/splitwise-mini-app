import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentAdmin } from '../auth/admin.decorator';
import { AdminUsersService } from './admin-users.service';
import { AdminRole } from '@prisma/client';

@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Get()
  @Roles('READ_ONLY')
  listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('godMode') godMode?: string,
  ) {
    return this.usersService.listUsers({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      godMode: godMode === 'true' ? true : godMode === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  @Roles('READ_ONLY')
  getUser(@Param('id') id: string) {
    return this.usersService.getUser(id);
  }

  @Patch(':id/god-mode')
  @Roles('ADMIN')
  toggleGodMode(
    @Param('id') id: string,
    @Body() body: { enabled: boolean; reason: string },
    @CurrentAdmin() admin: { id: string; role: AdminRole },
    @Req() req: any,
  ) {
    return this.usersService.toggleGodMode(
      id,
      body.enabled,
      admin,
      body.reason,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post(':id/entitlements')
  @Roles('ADMIN')
  grantEntitlement(
    @Param('id') userId: string,
    @Body() body: { groupId: string; productCode: string; durationDays: number; reason: string },
    @CurrentAdmin() admin: { id: string; role: AdminRole },
    @Req() req: any,
  ) {
    return this.usersService.grantEntitlement(
      userId,
      { groupId: body.groupId, productCode: body.productCode, durationDays: body.durationDays },
      admin,
      body.reason,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Patch('entitlements/:entitlementId/revoke')
  @Roles('ADMIN')
  revokeEntitlement(
    @Param('entitlementId') entitlementId: string,
    @Body() body: { reason: string },
    @CurrentAdmin() admin: { id: string; role: AdminRole },
    @Req() req: any,
  ) {
    return this.usersService.revokeEntitlement(
      entitlementId,
      admin,
      body.reason,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Patch('entitlements/:entitlementId/extend')
  @Roles('ADMIN')
  extendEntitlement(
    @Param('entitlementId') entitlementId: string,
    @Body() body: { extraDays: number; reason: string },
    @CurrentAdmin() admin: { id: string; role: AdminRole },
    @Req() req: any,
  ) {
    return this.usersService.extendEntitlement(
      entitlementId,
      body.extraDays,
      admin,
      body.reason,
      req.ip,
      req.headers['user-agent'],
    );
  }
}




