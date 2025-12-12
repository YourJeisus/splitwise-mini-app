import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Telegraf } from "telegraf";
import crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";

const TRIP_PASS_PRODUCT_CODE = "TRIP_PASS_21D";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class MonetizationService {
  private bot: Telegraf | null = null;
  private readonly isDev: boolean;
  private readonly isTestEnv: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {
    this.isDev = this.config.get<string>("NODE_ENV") === "development";
    this.isTestEnv = this.config.get<string>("TELEGRAM_TEST_ENV") === "true";
    const token =
      (this.isDev && this.config.get<string>("BOT_TOKEN_DEV")) ||
      this.config.get<string>("BOT_TOKEN");
    if (token) {
      this.bot = new Telegraf(token, { telegram: { testEnv: this.isTestEnv } });
    }
  }

  private getSettlementFeeAmountForCurrency(
    product: { priceBySettlementCurrency: any },
    settlementCurrency: string
  ): number {
    const map = (product.priceBySettlementCurrency ?? {}) as Record<
      string,
      number
    >;
    const raw = map[settlementCurrency];
    const value = typeof raw === "string" ? Number(raw) : raw;
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException(
        `Trip Pass недоступен для валюты ${settlementCurrency}`
      );
    }
    return round2(value);
  }

  async createTripPassInvoice(params: {
    groupId: string;
    buyerUserId: string;
    splitCost: boolean;
  }): Promise<{ invoiceLink: string; purchaseId: string }> {
    const canCreateInvoiceLink = Boolean(this.bot) && !this.isTestEnv;

    const member = await this.prisma.groupMember.findFirst({
      where: {
        groupId: params.groupId,
        userId: params.buyerUserId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!member) {
      throw new ForbiddenException("Вы не состоите в этой группе");
    }

    const now = new Date();
    const activeEntitlement = await this.prisma.entitlement.findFirst({
      where: {
        groupId: params.groupId,
        productCode: TRIP_PASS_PRODUCT_CODE,
        endsAt: { gt: now },
      },
      select: { id: true },
    });
    if (activeEntitlement) {
      throw new ConflictException("Trip Pass уже активен");
    }

    const [product, group] = await Promise.all([
      this.prisma.product.findFirst({
        where: { code: TRIP_PASS_PRODUCT_CODE, active: true },
      }),
      this.prisma.group.findUnique({
        where: { id: params.groupId },
        select: { settlementCurrency: true },
      }),
    ]);
    if (!product) {
      throw new InternalServerErrorException("Trip Pass продукт не найден");
    }
    if (!group) {
      throw new BadRequestException("Группа не найдена");
    }

    const settlementFeeAmount = this.getSettlementFeeAmountForCurrency(
      product,
      group.settlementCurrency
    );

    const invoicePayload = `tp_${crypto.randomUUID()}`;

    const purchase = await this.prisma.purchase.create({
      data: {
        productCode: product.code,
        groupId: params.groupId,
        buyerUserId: params.buyerUserId,
        invoicePayload,
        starsAmount: product.starsPrice,
        currency: "XTR",
        status: "CREATED",
        splitCost: params.splitCost,
        settlementFeeAmount,
        settlementCurrency: group.settlementCurrency,
      },
      select: { id: true },
    });

    if (!canCreateInvoiceLink) {
      if (!this.isDev && !this.isTestEnv) {
        throw new InternalServerErrorException("Оплата недоступна");
      }
      return { invoiceLink: "", purchaseId: purchase.id };
    }

    const invoiceLink = (await this.bot!.telegram.callApi("createInvoiceLink", {
      title: product.title,
      description: "Trip Pass на 21 день",
      payload: invoicePayload,
      provider_token: "",
      currency: "XTR",
      prices: [{ label: product.title, amount: product.starsPrice }],
    })) as unknown as string;

    return { invoiceLink, purchaseId: purchase.id };
  }

  private async activatePurchaseTx(
    tx: any,
    purchase: any,
    telegramPaymentChargeId: string,
    now: Date
  ) {
    if (purchase.status === "PAID") return;

    await tx.purchase.update({
      where: { id: purchase.id },
      data: {
        telegramPaymentChargeId,
        status: "PAID",
        paidAt: now,
      },
    });

    await tx.entitlement.create({
      data: {
        groupId: purchase.groupId,
        productCode: purchase.productCode,
        startsAt: now,
        endsAt: addDays(now, purchase.product.durationDays),
        purchaseId: purchase.id,
      },
    });

    if (!purchase.splitCost) return;

    const members = await tx.groupMember.findMany({
      where: { groupId: purchase.groupId, isActive: true },
      select: { userId: true },
    });

    const memberIds = members.map((m: any) => m.userId);
    if (!memberIds.includes(purchase.buyerUserId)) {
      memberIds.push(purchase.buyerUserId);
    }
    if (memberIds.length === 0) return;

    const total = Number(purchase.settlementFeeAmount);
    const totalCents = Math.round(total * 100);
    const base = Math.floor(totalCents / memberIds.length);
    const remainder = totalCents - base * memberIds.length;

    const shares = memberIds.map((userId: string) => {
      const owedCents = base + (userId === purchase.buyerUserId ? remainder : 0);
      const paidCents = userId === purchase.buyerUserId ? totalCents : 0;
      return {
        userId,
        paid: round2(paidCents / 100),
        owed: round2(owedCents / 100),
      };
    });

    await tx.expense.create({
      data: {
        groupId: purchase.groupId,
        createdById: purchase.buyerUserId,
        description: "Trip Pass (21 день)",
        settlementAmount: purchase.settlementFeeAmount,
        settlementCurrency: purchase.settlementCurrency,
        originalAmount: purchase.settlementFeeAmount,
        originalCurrency: purchase.settlementCurrency,
        fxRate: 1,
        fxDate: null,
        fxSource: "SETTLEMENT",
        isSystem: true,
        systemType: "TRIP_PASS_FEE",
        purchaseId: purchase.id,
        shares: { create: shares },
      },
    });
  }

  async validatePreCheckout(params: {
    invoicePayload: string;
    totalAmount: number;
    currency: string;
    fromTelegramUserId: number;
  }): Promise<{ ok: boolean; errorMessage?: string }> {
    const purchase = await this.prisma.purchase.findUnique({
      where: { invoicePayload: params.invoicePayload },
      select: {
        status: true,
        starsAmount: true,
        currency: true,
        buyerUserId: true,
      },
    });
    if (!purchase) return { ok: false, errorMessage: "Покупка не найдена" };
    if (purchase.status !== "CREATED")
      return { ok: false, errorMessage: "Покупка уже обработана" };
    if (purchase.currency !== "XTR" || params.currency !== "XTR")
      return { ok: false, errorMessage: "Неверная валюта" };
    if (purchase.starsAmount !== params.totalAmount)
      return { ok: false, errorMessage: "Неверная сумма" };

    const user = await this.prisma.user.findUnique({
      where: { telegramId: String(params.fromTelegramUserId) },
      select: { id: true },
    });
    if (!user || user.id !== purchase.buyerUserId) {
      return { ok: false, errorMessage: "Неверный плательщик" };
    }

    return { ok: true };
  }

  async confirmSuccessfulPayment(params: {
    invoicePayload: string;
    telegramPaymentChargeId: string;
    totalAmount: number;
    currency: string;
    paidTelegramUserId: number;
  }) {
    await this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { invoicePayload: params.invoicePayload },
        include: { product: true },
      });
      if (!purchase) {
        throw new BadRequestException("Покупка не найдена");
      }

      if (purchase.status === "PAID") return;

      if (purchase.currency !== "XTR" || params.currency !== "XTR") {
        throw new BadRequestException("Неверная валюта");
      }
      if (purchase.starsAmount !== params.totalAmount) {
        throw new BadRequestException("Неверная сумма");
      }

      const user = await tx.user.findUnique({
        where: { telegramId: String(params.paidTelegramUserId) },
        select: { id: true },
      });
      if (!user || user.id !== purchase.buyerUserId) {
        throw new BadRequestException("Неверный плательщик");
      }

      const now = new Date();
      await this.activatePurchaseTx(
        tx,
        purchase,
        params.telegramPaymentChargeId,
        now
      );
    });
  }

  async devConfirmTripPassPurchase(params: {
    purchaseId: string;
    buyerUserId: string;
  }) {
    if (!this.isDev && !this.isTestEnv)
      throw new ForbiddenException("Dev endpoint disabled");
    if (!params.purchaseId) throw new BadRequestException("purchaseId is required");

    const purchase = await this.prisma.purchase.findUnique({
      where: { id: params.purchaseId },
      select: { id: true, groupId: true },
    });
    if (!purchase) throw new BadRequestException("Покупка не найдена");

    const member = await this.prisma.groupMember.findFirst({
      where: { groupId: purchase.groupId, userId: params.buyerUserId, isActive: true },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException("Нет доступа к группе");

    await this.prisma.$transaction(async (tx) => {
      const full = await tx.purchase.findUnique({
        where: { id: params.purchaseId },
        include: { product: true },
      });
      if (!full) throw new BadRequestException("Покупка не найдена");
      if (full.buyerUserId !== params.buyerUserId) {
        throw new ForbiddenException("Нельзя подтвердить чужую покупку");
      }
      const now = new Date();
      await this.activatePurchaseTx(tx, full, `dev_${full.id}`, now);
    });

    return this.getTripPassStatus(purchase.groupId, params.buyerUserId);
  }

  async getTripPassStatus(groupId: string, userId: string): Promise<{
    active: boolean;
    endsAt?: string;
  }> {
    const member = await this.prisma.groupMember.findFirst({
      where: { groupId, userId, isActive: true },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException("Нет доступа к группе");

    const now = new Date();
    const entitlement = await this.prisma.entitlement.findFirst({
      where: {
        groupId,
        productCode: TRIP_PASS_PRODUCT_CODE,
        endsAt: { gt: now },
      },
      orderBy: { endsAt: "desc" },
      select: { endsAt: true },
    });

    if (!entitlement) return { active: false };
    return { active: true, endsAt: entitlement.endsAt.toISOString() };
  }

  async devToggleTripPass(params: { groupId: string; userId: string; active: boolean }) {
    if (!this.isDev && !this.isTestEnv)
      throw new ForbiddenException("Dev endpoint disabled");

    const member = await this.prisma.groupMember.findFirst({
      where: { groupId: params.groupId, userId: params.userId, isActive: true },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException("Нет доступа к группе");

    if (params.active) {
      // Включаем: создаём или продлеваем entitlement
      const now = new Date();
      const endsAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // +1 год
      const existing = await this.prisma.entitlement.findFirst({
        where: { groupId: params.groupId, productCode: TRIP_PASS_PRODUCT_CODE },
      });
      if (existing) {
        await this.prisma.entitlement.update({
          where: { id: existing.id },
          data: { endsAt },
        });
      } else {
        // Создаём фиктивный purchase для dev entitlement
        const devPurchase = await this.prisma.purchase.create({
          data: {
            productCode: TRIP_PASS_PRODUCT_CODE,
            groupId: params.groupId,
            buyerUserId: params.userId,
            invoicePayload: `dev_toggle_${crypto.randomUUID()}`,
            starsAmount: 0,
            currency: "XTR",
            status: "PAID",
            splitCost: false,
            settlementFeeAmount: 0,
            settlementCurrency: "USD",
            paidAt: now,
          },
        });
        await this.prisma.entitlement.create({
          data: {
            groupId: params.groupId,
            productCode: TRIP_PASS_PRODUCT_CODE,
            startsAt: now,
            endsAt,
            purchaseId: devPurchase.id,
          },
        });
      }
    } else {
      // Выключаем: устанавливаем endsAt в прошлое
      await this.prisma.entitlement.updateMany({
        where: { groupId: params.groupId, productCode: TRIP_PASS_PRODUCT_CODE },
        data: { endsAt: new Date(0) },
      });
    }

    return this.getTripPassStatus(params.groupId, params.userId);
  }

  async enableTripPassSplit(params: { purchaseId: string; userId: string }) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: params.purchaseId },
      include: { product: true },
    });

    if (!purchase) throw new BadRequestException("Покупка не найдена");
    if (purchase.buyerUserId !== params.userId) {
      throw new ForbiddenException("Только покупатель может разделить стоимость");
    }
    if (purchase.status !== "PAID") {
      throw new BadRequestException("Покупка не оплачена");
    }

    // Проверяем, что expense ещё не создан
    const existingExpense = await this.prisma.expense.findUnique({
      where: { purchaseId: params.purchaseId },
    });
    if (existingExpense) {
      throw new ConflictException("Трата уже создана");
    }

    const members = await this.prisma.groupMember.findMany({
      where: { groupId: purchase.groupId, isActive: true },
      select: { userId: true },
    });

    const memberIds = members.map((m) => m.userId);
    if (!memberIds.includes(purchase.buyerUserId)) {
      memberIds.push(purchase.buyerUserId);
    }
    if (memberIds.length === 0) {
      throw new BadRequestException("Нет участников для распределения");
    }

    const total = Number(purchase.settlementFeeAmount);
    const totalCents = Math.round(total * 100);
    const base = Math.floor(totalCents / memberIds.length);
    const remainder = totalCents - base * memberIds.length;

    const shares = memberIds.map((userId: string) => {
      const owedCents = base + (userId === purchase.buyerUserId ? remainder : 0);
      const paidCents = userId === purchase.buyerUserId ? totalCents : 0;
      return {
        userId,
        paid: round2(paidCents / 100),
        owed: round2(owedCents / 100),
      };
    });

    await this.prisma.expense.create({
      data: {
        groupId: purchase.groupId,
        createdById: purchase.buyerUserId,
        description: "Trip Pass (21 день)",
        settlementAmount: purchase.settlementFeeAmount,
        settlementCurrency: purchase.settlementCurrency,
        originalAmount: purchase.settlementFeeAmount,
        originalCurrency: purchase.settlementCurrency,
        fxRate: 1,
        fxDate: null,
        fxSource: "SETTLEMENT",
        isSystem: true,
        systemType: "TRIP_PASS_FEE",
        purchaseId: purchase.id,
        shares: { create: shares },
      },
    });

    await this.prisma.purchase.update({
      where: { id: params.purchaseId },
      data: { splitCost: true },
    });

    return { success: true };
  }
}


