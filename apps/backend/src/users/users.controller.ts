import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { TelegramAuthGuard } from '../auth/telegram.guard';
import { AuthUser } from '../common/decorators/auth-user.decorator';
import { UsersService } from './users.service';
import { AddFriendDto } from './dto/add-friend.dto';

@UseGuards(TelegramAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@AuthUser() user: any) {
    return user;
  }

  @Get('friends')
  listFriends(@AuthUser() user: any) {
    return this.usersService.getFriends(user.id);
  }

  @Post('friends')
  addFriend(@AuthUser() user: any, @Body() dto: AddFriendDto) {
    return this.usersService.addFriend(user.id, dto.telegramId);
  }
}

