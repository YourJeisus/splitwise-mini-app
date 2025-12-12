import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { TelegramAuthGuard } from "../auth/telegram.guard";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import { CreateTripPassInvoiceDto } from "./dto/create-trip-pass-invoice.dto";
import { MonetizationService } from "./monetization.service";

@UseGuards(TelegramAuthGuard)
@Controller("monetization")
export class MonetizationController {
  constructor(private readonly monetizationService: MonetizationService) {}

  @Post("trip-pass/invoice")
  createTripPassInvoice(@AuthUser() user: any, @Body() dto: CreateTripPassInvoiceDto) {
    return this.monetizationService.createTripPassInvoice({
      groupId: dto.groupId,
      buyerUserId: user.id,
      splitCost: dto.splitCost,
    });
  }

  @Get("trip-pass/status")
  getTripPassStatus(@AuthUser() user: any, @Query("groupId") groupId: string) {
    return this.monetizationService.getTripPassStatus(groupId, user.id);
  }

  @Post("trip-pass/dev/confirm")
  devConfirmTripPass(@AuthUser() user: any, @Body() body: { purchaseId?: string }) {
    if (!body?.purchaseId) throw new BadRequestException("purchaseId is required");
    return this.monetizationService.devConfirmTripPassPurchase({
      buyerUserId: user.id,
      purchaseId: body.purchaseId,
    });
  }

  @Post("trip-pass/dev/toggle")
  devToggleTripPass(@AuthUser() user: any, @Body() body: { groupId: string; active: boolean }) {
    if (!body?.groupId) throw new BadRequestException("groupId is required");
    return this.monetizationService.devToggleTripPass({
      groupId: body.groupId,
      userId: user.id,
      active: body.active,
    });
  }

  @Post("trip-pass/enable-split")
  enableTripPassSplit(@AuthUser() user: any, @Body() body: { purchaseId: string }) {
    if (!body?.purchaseId) throw new BadRequestException("purchaseId is required");
    return this.monetizationService.enableTripPassSplit({
      purchaseId: body.purchaseId,
      userId: user.id,
    });
  }
}


