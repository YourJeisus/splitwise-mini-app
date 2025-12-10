import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Delete,
  UseGuards,
} from "@nestjs/common";
import { TelegramAuthGuard } from "../auth/telegram.guard";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import { GroupsService } from "./groups.service";
import { CreateGroupDto } from "./dto/create-group.dto";

@Controller("groups")
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  // Публичный эндпоинт для получения инфо о группе по invite-коду
  @Get("invite/:inviteCode")
  getByInvite(@Param("inviteCode") inviteCode: string) {
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
  @Post("join/:inviteCode")
  join(@AuthUser() user: any, @Param("inviteCode") inviteCode: string) {
    return this.groupsService.joinByInvite(user.id, inviteCode);
  }

  @UseGuards(TelegramAuthGuard)
  @Patch(":id")
  update(
    @AuthUser() user: any,
    @Param("id") id: string,
    @Body() dto: { name?: string; currency?: string }
  ) {
    return this.groupsService.update(user.id, id, dto);
  }

  @UseGuards(TelegramAuthGuard)
  @Delete(":id")
  delete(@AuthUser() user: any, @Param("id") id: string) {
    return this.groupsService.delete(user.id, id);
  }

  @UseGuards(TelegramAuthGuard)
  @Post(":id/leave")
  leave(@AuthUser() user: any, @Param("id") id: string) {
    return this.groupsService.leaveGroup(user.id, id);
  }

  @UseGuards(TelegramAuthGuard)
  @Get(":id/balance")
  balance(@Param("id") id: string) {
    return this.groupsService.getBalance(id);
  }
}
