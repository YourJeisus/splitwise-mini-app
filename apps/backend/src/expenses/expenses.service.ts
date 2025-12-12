import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";

const TRIP_PASS_PRODUCT_CODE = "TRIP_PASS_21D";

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private mapExpenseForApi(expense: any) {
    return {
      ...expense,
      amount: expense.settlementAmount,
      currency: expense.settlementCurrency,
    };
  }

  async create(userId: string, dto: CreateExpenseDto) {
    const group = dto.groupId
      ? await this.prisma.group.findUnique({
          where: { id: dto.groupId },
          select: {
            settlementCurrency: true,
            fxMode: true,
            fixedFxRates: true,
            fixedFxDate: true,
            fixedFxSource: true,
            closedAt: true,
          },
        })
      : null;

    if (group?.closedAt) {
      throw new BadRequestException("Группа закрыта");
    }

    const settlementCurrency =
      group?.settlementCurrency ?? dto.currency ?? "USD";

    if (dto.currency && dto.currency !== settlementCurrency) {
      throw new BadRequestException(
        "Валюта траты должна совпадать с валютой расчётов группы"
      );
    }

    const settlementAmount = this.round2(dto.amount);
    const originalCurrency = dto.originalCurrency ?? settlementCurrency;
    const originalAmount = this.round2(dto.originalAmount ?? dto.amount);

    let fxRate: number | null = null;
    let fxDate: Date | null = null;
    let fxSource: string | null = null;

    if (originalCurrency !== settlementCurrency) {
      if (!dto.groupId) {
        throw new BadRequestException("Мультивалюта доступна только в группе");
      }
      const now = new Date();
      const entitlement = await this.prisma.entitlement.findFirst({
        where: {
          groupId: dto.groupId,
          productCode: TRIP_PASS_PRODUCT_CODE,
          endsAt: { gt: now },
        },
        select: { id: true },
      });
      if (!entitlement) {
        throw new BadRequestException("Мультивалютные траты доступны с Trip Pass");
      }
      if (group?.fxMode !== "FIXED") {
        throw new BadRequestException("FX режим не поддерживается");
      }
      const rates = (group.fixedFxRates ?? {}) as Record<string, number>;
      const rate = rates[originalCurrency];
      if (!rate) {
        throw new BadRequestException(
          `Нет фиксированного курса для ${originalCurrency}`
        );
      }
      fxRate = rate;
      fxDate = group.fixedFxDate ?? new Date();
      fxSource = group.fixedFxSource ?? "FIXED";

      const expectedSettlement = this.round2(originalAmount * rate);
      if (Math.abs(expectedSettlement - settlementAmount) > 0.01) {
        throw new BadRequestException("Некорректная сумма после конвертации");
      }
    } else {
      fxRate = 1;
      fxSource = "SETTLEMENT";
    }

    const now = new Date();
    const expense = await this.prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          description: dto.description,
          settlementAmount,
          settlementCurrency,
          originalAmount,
          originalCurrency,
          fxRate,
          fxDate,
          fxSource,
          category: dto.category,
          groupId: dto.groupId,
          createdById: userId,
          shares: {
            create: dto.shares.map((share) => ({
              userId: share.userId,
              paid: share.paid,
              owed: share.owed,
            })),
          },
        },
        include: { shares: true },
      });

      if (dto.groupId) {
        await tx.group.update({
          where: { id: dto.groupId },
          data: { lastActivityAt: now },
        });
      }

      return created;
    });

    return this.mapExpenseForApi(expense);
  }

  async listByGroup(groupId: string) {
    const [expenses, settlements] = await Promise.all([
      this.prisma.expense.findMany({
        where: { groupId },
        include: {
          shares: {
            include: {
              user: {
                select: { id: true, firstName: true, username: true },
              },
            },
          },
          createdBy: {
            select: { id: true, firstName: true, username: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.settlement.findMany({
        where: { groupId },
        include: {
          fromUser: {
            select: { id: true, firstName: true, username: true },
          },
          toUser: {
            select: { id: true, firstName: true, username: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Объединяем и сортируем по дате
    const combined = [
      ...expenses.map((e) => ({
        ...this.mapExpenseForApi(e),
        type: "expense" as const,
      })),
      ...settlements.map((s) => ({ ...s, type: "settlement" as const })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return combined;
  }

  async update(
    userId: string,
    expenseId: string,
    dto: {
      description?: string;
      amount?: number;
      shares?: { userId: string; paid: number; owed: number }[];
    }
  ) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!expense) throw new NotFoundException("Расход не найден");
    if (expense.isSystem) {
      throw new ForbiddenException("Системный расход нельзя редактировать");
    }
    if (expense.createdById !== userId) {
      throw new ForbiddenException(
        "Только создатель может редактировать расход"
      );
    }

    // Если обновляются shares, удаляем старые и создаём новые
    if (dto.shares) {
      await this.prisma.expenseShare.deleteMany({
        where: { expenseId },
      });
    }

    const updated = await this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...(dto.description && { description: dto.description }),
        ...(dto.amount !== undefined && {
          settlementAmount: this.round2(dto.amount),
          originalAmount: this.round2(dto.amount),
          originalCurrency: expense.settlementCurrency,
          fxRate: 1,
          fxDate: null,
          fxSource: "SETTLEMENT",
        }),
        ...(dto.shares && {
          shares: {
            create: dto.shares.map((share) => ({
              userId: share.userId,
              paid: share.paid,
              owed: share.owed,
            })),
          },
        }),
      },
      include: {
        shares: {
          include: {
            user: {
              select: { id: true, firstName: true, username: true },
            },
          },
        },
      },
    });

    return this.mapExpenseForApi(updated);
  }

  async delete(userId: string, expenseId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!expense) throw new NotFoundException("Расход не найден");
    if (expense.isSystem) {
      throw new ForbiddenException("Системный расход нельзя удалять");
    }
    if (expense.createdById !== userId) {
      throw new ForbiddenException("Только создатель может удалить расход");
    }

    await this.prisma.$transaction([
      this.prisma.expenseShare.deleteMany({
        where: { expenseId },
      }),
      this.prisma.expense.delete({
        where: { id: expenseId },
      }),
    ]);

    return { success: true };
  }
}
