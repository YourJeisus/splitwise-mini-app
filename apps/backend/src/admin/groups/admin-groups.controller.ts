import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../auth/admin-jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminGroupsService } from './admin-groups.service';

@UseGuards(AdminJwtGuard, RolesGuard)
@Controller('admin/groups')
export class AdminGroupsController {
  constructor(private readonly groupsService: AdminGroupsService) {}

  @Get()
  @Roles('READ_ONLY')
  listGroups(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('closed') closed?: string,
    @Query('hasTripPass') hasTripPass?: string,
  ) {
    return this.groupsService.listGroups({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      closed: closed === 'true' ? true : closed === 'false' ? false : undefined,
      hasTripPass: hasTripPass === 'true' ? true : hasTripPass === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  @Roles('READ_ONLY')
  getGroup(@Param('id') id: string) {
    return this.groupsService.getGroup(id);
  }
}


