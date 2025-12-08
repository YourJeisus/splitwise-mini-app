import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { TelegramAuthGuard } from '../auth/telegram.guard';
import { AuthUser } from '../common/decorators/auth-user.decorator';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { SettlementsService } from './settlements.service';

@UseGuards(TelegramAuthGuard)
@Controller('settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Post()
  create(@AuthUser() user: any, @Body() dto: CreateSettlementDto) {
    return this.settlementsService.create(user.id, dto);
  }

  @Get()
  list(@AuthUser() user: any) {
    return this.settlementsService.list(user.id);
  }
}

