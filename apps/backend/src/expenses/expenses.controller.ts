import { Body, Controller, Get, Param, Post, Patch, Delete, UseGuards } from '@nestjs/common';
import { TelegramAuthGuard } from '../auth/telegram.guard';
import { AuthUser } from '../common/decorators/auth-user.decorator';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpensesService } from './expenses.service';

@UseGuards(TelegramAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(@AuthUser() user: any, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(user.id, dto);
  }

  @Get('group/:groupId')
  listByGroup(@Param('groupId') groupId: string) {
    return this.expensesService.listByGroup(groupId);
  }

  @Patch(':id')
  update(
    @AuthUser() user: any,
    @Param('id') id: string,
    @Body() dto: { description?: string; amount?: number; shares?: { userId: string; paid: number; owed: number }[] }
  ) {
    return this.expensesService.update(user.id, id, dto);
  }

  @Delete(':id')
  delete(@AuthUser() user: any, @Param('id') id: string) {
    return this.expensesService.delete(user.id, id);
  }
}

