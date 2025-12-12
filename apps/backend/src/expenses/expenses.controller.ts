import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { TelegramAuthGuard } from "../auth/telegram.guard";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { CreateReceiptDto, ClaimReceiptItemsDto } from "./dto/create-receipt.dto";
import { ExpensesService } from "./expenses.service";

@UseGuards(TelegramAuthGuard)
@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  // ========== RECEIPT ENDPOINTS ==========

  @Post("receipt/scan")
  @UseInterceptors(FileInterceptor("image"))
  scanReceipt(
    @AuthUser() user: any,
    @UploadedFile() image: Express.Multer.File,
    @Body("groupId") groupId: string
  ) {
    return this.expensesService.scanReceipt(user.id, groupId, image);
  }

  @Post("receipt")
  createReceipt(@AuthUser() user: any, @Body() dto: CreateReceiptDto) {
    return this.expensesService.createReceipt(user.id, dto);
  }

  @Get("receipt/:id")
  getReceipt(@Param("id") id: string) {
    return this.expensesService.getReceiptDetails(id);
  }

  @Get("receipt/by-expense/:expenseId")
  getReceiptByExpense(@Param("expenseId") expenseId: string) {
    return this.expensesService.getReceiptByExpenseId(expenseId);
  }

  @Get("receipts/group/:groupId")
  listGroupReceipts(@Param("groupId") groupId: string) {
    return this.expensesService.listGroupReceipts(groupId);
  }

  @Post("receipt/claim")
  claimReceiptItems(@AuthUser() user: any, @Body() dto: ClaimReceiptItemsDto) {
    return this.expensesService.claimReceiptItems(user.id, dto);
  }

  @Post("receipt/:id/finalize")
  finalizeReceipt(@AuthUser() user: any, @Param("id") id: string) {
    return this.expensesService.finalizeReceipt(user.id, id);
  }

  // ========== EXPENSE ENDPOINTS ==========

  @Post()
  create(@AuthUser() user: any, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(user.id, dto);
  }

  @Get("group/:groupId")
  listByGroup(@Param("groupId") groupId: string) {
    return this.expensesService.listByGroup(groupId);
  }

  @Patch(":id")
  update(
    @AuthUser() user: any,
    @Param("id") id: string,
    @Body()
    dto: {
      description?: string;
      amount?: number;
      shares?: { userId: string; paid: number; owed: number }[];
    }
  ) {
    return this.expensesService.update(user.id, id, dto);
  }

  @Delete(":id")
  delete(@AuthUser() user: any, @Param("id") id: string) {
    return this.expensesService.delete(user.id, id);
  }
}

