import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { TelegramAuthGuard } from '../auth/telegram.guard';
import { AuthUser } from '../common/decorators/auth-user.decorator';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  // Публичный эндпоинт для получения инфо о группе по invite-коду
  @Get('invite/:inviteCode')
  getByInvite(@Param('inviteCode') inviteCode: string) {
    return this.groupsService.getByInviteCode(inviteCode);
  }

  @UseGuards(TelegramAuthGuard)
  @Get()
  list(@AuthUser() user: any) {
    return this.groupsService.list(user.id);
  }

  @UseGuards(TelegramAuthGuard)
  @Post()
  create(@AuthUser() user: any, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(user.id, dto);
  }

  @UseGuards(TelegramAuthGuard)
  @Post('join/:inviteCode')
  join(@AuthUser() user: any, @Param('inviteCode') inviteCode: string) {
    return this.groupsService.joinByInvite(user.id, inviteCode);
  }

  @UseGuards(TelegramAuthGuard)
  @Get(':id/balance')
  balance(@Param('id') id: string) {
    return this.groupsService.getBalance(id);
  }
}

