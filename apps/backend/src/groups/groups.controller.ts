import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { TelegramAuthGuard } from '../auth/telegram.guard';
import { AuthUser } from '../common/decorators/auth-user.decorator';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';

@UseGuards(TelegramAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  list(@AuthUser() user: any) {
    return this.groupsService.list(user.id);
  }

  @Post()
  create(@AuthUser() user: any, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(user.id, dto);
  }

  @Post('join/:inviteCode')
  join(@AuthUser() user: any, @Param('inviteCode') inviteCode: string) {
    return this.groupsService.joinByInvite(user.id, inviteCode);
  }

  @Get(':id/balance')
  balance(@Param('id') id: string) {
    return this.groupsService.getBalance(id);
  }
}

