import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GroupRole, GroupFxMode } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UploadService } from "../upload/upload.service";
import { CreateGroupDto } from "./dto/create-group.dto";

const ACTIVE_GROUPS_LIMIT = 2;
const ACTIVE_GROUPS_LIMIT_MESSAGE =
  "Для нескольких поездок одновременно удобнее Trip Pass или подписка";
const TRIP_PASS_PRODUCT_CODE = "TRIP_PASS_30D";

// Бесплатный API без ключа (поддерживает RUB)
const FX_PROVIDER_URL = "https://open.er-api.com/v6/latest";

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
    private readonly config: ConfigService
  ) {}

  private async getActiveGroupsCount(userId: string): Promise<number> {
    return this.prisma.groupMember.count({
      where: {
        userId,
        isActive: true,
        group: { closedAt: null },
      },
    });
  }

  private async assertActiveGroupsLimit(userId: string) {
    // Check if user has GodMode enabled
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { godModeEnabled: true },
    });
    if (user?.godModeEnabled) {
      return; // GodMode bypasses limit
    }

    const activeCount = await this.getActiveGroupsCount(userId);
    if (activeCount >= ACTIVE_GROUPS_LIMIT) {
      throw new ForbiddenException(ACTIVE_GROUPS_LIMIT_MESSAGE);
    }
  }

  /**
   * Проверяет активный Trip Pass и при необходимости запрашивает курс
   * для homeCurrency у внешнего провайдера, сохраняя в fixedFxRates.
   */
  private async ensureHomeFxRate(groupId: string): Promise<{
    homeFxRate?: number;
    homeFxDate?: Date;
    homeFxSource?: string;
  }> {
    console.log("[ensureHomeFxRate] Called for groupId:", groupId);
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: {
        homeCurrency: true,
        settlementCurrency: true,
        fixedFxRates: true,
        fixedFxDate: true,
        fixedFxSource: true,
      },
    });
    if (!group) {
      console.log("[ensureHomeFxRate] Group not found");
      return {};
    }

    const { homeCurrency, settlementCurrency, fixedFxRates, fixedFxDate, fixedFxSource } = group;
    console.log("[ensureHomeFxRate] Group data:", { homeCurrency, settlementCurrency, fixedFxRates });

    // Если homeCurrency не задана или совпадает с settlementCurrency — не нужен курс
    if (!homeCurrency || homeCurrency === settlementCurrency) {
      console.log("[ensureHomeFxRate] No homeCurrency or same as settlement");
      return {};
    }

    const rates = (fixedFxRates ?? {}) as Record<string, number>;
    const existingRate = rates[homeCurrency];
    console.log("[ensureHomeFxRate] Existing rate:", existingRate);

    // Если курс уже есть — возвращаем (курс фиксируется один раз)
    if (existingRate && existingRate > 0) {
      console.log("[ensureHomeFxRate] Returning existing rate");
      return {
        homeFxRate: existingRate,
        homeFxDate: fixedFxDate ?? undefined,
        homeFxSource: fixedFxSource ?? undefined,
      };
    }

    // Проверяем активный Trip Pass
    const now = new Date();
    const entitlement = await this.prisma.entitlement.findFirst({
      where: {
        groupId,
        productCode: TRIP_PASS_PRODUCT_CODE,
        endsAt: { gt: now },
      },
      select: { id: true },
    });
    console.log("[ensureHomeFxRate] Entitlement:", entitlement);
    if (!entitlement) {
      // Trip Pass не активен — курс не нужен
      console.log("[ensureHomeFxRate] No active Trip Pass");
      return {};
    }

    // Пытаемся получить курс от провайдера (open.er-api.com — бесплатный, поддерживает RUB)
    try {
      const url = `${FX_PROVIDER_URL}/${settlementCurrency}`;

      console.log("[ensureHomeFxRate] Fetching FX rate:", url);
      const response = await fetch(url);
      console.log("[ensureHomeFxRate] Response status:", response.status);
      if (!response.ok) {
        console.log("[ensureHomeFxRate] Response not ok");
        return {};
      }
      const data = (await response.json()) as {
        result?: string;
        rates?: Record<string, number>;
      };
      console.log("[ensureHomeFxRate] Response result:", data.result, "has rates:", !!data.rates);
      if (data.result !== "success" || !data.rates) {
        console.log("[ensureHomeFxRate] No success/rates in response");
        return {};
      }
      const fetchedRate = data.rates[homeCurrency];
      if (!fetchedRate || fetchedRate <= 0) {
        console.log("[ensureHomeFxRate] Invalid rate:", fetchedRate);
        return {};
      }

      // Сохраняем курс в группе
      const newRates = { ...rates, [homeCurrency]: fetchedRate };
      const fetchDate = new Date();
      await this.prisma.group.update({
        where: { id: groupId },
        data: {
          fixedFxRates: newRates,
          fixedFxDate: fetchDate,
          fixedFxSource: "open.er-api.com",
        },
      });

      console.log("[ensureHomeFxRate] Saved rate:", fetchedRate);
      return {
        homeFxRate: fetchedRate,
        homeFxDate: fetchDate,
        homeFxSource: "open.er-api.com",
      };
    } catch {
      // Провайдер недоступен — не падаем
      return {};
    }
  }

  async list(userId: string) {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId, isActive: true },
      include: {
        group: {
          include: {
            expenses: { include: { shares: true } },
            settlements: true,
          },
        },
      },
    });

    // Получаем активные entitlements для всех групп пользователя
    const now = new Date();
    const groupIds = memberships.map((m) => m.group.id);
    const activeEntitlements = await this.prisma.entitlement.findMany({
      where: {
        groupId: { in: groupIds },
        productCode: TRIP_PASS_PRODUCT_CODE,
        endsAt: { gt: now },
      },
      select: { groupId: true },
    });
    const groupsWithTripPass = new Set(activeEntitlements.map((e) => e.groupId));

    return memberships.map((member) => {
      // Рассчитываем баланс пользователя в этой группе
      let userBalance = 0;
      member.group.expenses.forEach((expense) => {
        expense.shares.forEach((share) => {
          if (share.userId === userId) {
            userBalance += Number(share.paid) - Number(share.owed);
          }
        });
      });
      // Учитываем settlements
      member.group.settlements.forEach((settlement) => {
        if (settlement.fromUserId === userId) {
          userBalance += Number(settlement.amount);
        }
        if (settlement.toUserId === userId) {
          userBalance -= Number(settlement.amount);
        }
      });

      return {
        id: member.group.id,
        name: member.group.name,
        imageUrl: member.group.imageUrl,
        currency: member.group.settlementCurrency,
        settlementCurrency: member.group.settlementCurrency,
        homeCurrency: member.group.homeCurrency,
        inviteCode: member.group.inviteCode,
        createdById: member.group.createdById,
        role: member.role,
        userBalance,
        closedAt: member.group.closedAt?.toISOString() || null,
        lastActivityAt: member.group.lastActivityAt?.toISOString() || null,
        hasTripPass: groupsWithTripPass.has(member.group.id),
      };
    });
  }

  async create(
    userId: string,
    dto: CreateGroupDto,
    image?: Express.Multer.File
  ) {
    await this.assertActiveGroupsLimit(userId);

    const group = await this.prisma.group.create({
      data: {
        name: dto.name,
        settlementCurrency: dto.settlementCurrency ?? "USD",
        homeCurrency: dto.homeCurrency,
        createdById: userId,
        members: {
          create: {
            userId,
            role: GroupRole.ADMIN,
          },
        },
      },
      include: { members: true },
    });

    if (image) {
      const imageUrl = await this.uploadService.uploadGroupImage(
        image,
        group.id
      );
      return this.prisma.group.update({
        where: { id: group.id },
        data: { imageUrl },
        include: { members: true },
      });
    }

    return group;
  }

  async getByInviteCode(inviteCode: string) {
    const group = await this.prisma.group.findUnique({
      where: { inviteCode },
      include: {
        _count: { select: { members: true } },
      },
    });
    if (!group) throw new NotFoundException("Группа не найдена");

    return {
      id: group.id,
      name: group.name,
      imageUrl: group.imageUrl,
      currency: group.settlementCurrency,
      settlementCurrency: group.settlementCurrency,
      homeCurrency: group.homeCurrency,
      membersCount: group._count.members,
    };
  }

  async joinByInvite(userId: string, inviteCode: string) {
    const group = await this.prisma.group.findUnique({
      where: { inviteCode },
    });
    if (!group) throw new NotFoundException("Группа не найдена");

    const existing = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId } },
    });

    if (existing) {
      // Если был в группе но вышел — возвращаем
      if (!existing.isActive) {
        if (!group.closedAt) {
          await this.assertActiveGroupsLimit(userId);
        }
        await this.prisma.groupMember.update({
          where: { id: existing.id },
          data: { isActive: true, leftAt: null },
        });
        return {
          id: group.id,
          name: group.name,
          imageUrl: group.imageUrl,
          currency: group.settlementCurrency,
          settlementCurrency: group.settlementCurrency,
          homeCurrency: group.homeCurrency,
          closedAt: group.closedAt,
          lastActivityAt: group.lastActivityAt,
        };
      }
      throw new ConflictException("Вы уже в этой группе");
    }

    if (!group.closedAt) {
      await this.assertActiveGroupsLimit(userId);
    }

    await this.prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: GroupRole.MEMBER,
      },
    });

    return {
      id: group.id,
      name: group.name,
      imageUrl: group.imageUrl,
      currency: group.settlementCurrency,
      settlementCurrency: group.settlementCurrency,
      homeCurrency: group.homeCurrency,
      closedAt: group.closedAt,
      lastActivityAt: group.lastActivityAt,
    };
  }

  async leaveGroup(userId: string, groupId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (!member) throw new NotFoundException("Вы не состоите в этой группе");
    if (!member.isActive)
      throw new ConflictException("Вы уже вышли из этой группы");

    // Создатель не может выйти из группы
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });
    if (group?.createdById === userId) {
      throw new ForbiddenException("Создатель не может выйти из группы");
    }

    await this.prisma.groupMember.update({
      where: { id: member.id },
      data: { isActive: false, leftAt: new Date() },
    });

    return { success: true };
  }

  async getBalance(groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        expenses: { include: { shares: true } },
        members: { include: { user: true } },
        settlements: true,
      },
    });
    if (!group) throw new NotFoundException("Group not found");

    // On-demand: при активном Trip Pass пытаемся заполнить homeFxRate
    const fxInfo = await this.ensureHomeFxRate(groupId);

    const userNames: Record<string, string> = {};
    const userAvatars: Record<string, string | null> = {};
    const memberIds: string[] = [];
    const inactiveMembers: Record<string, boolean> = {};

    group.members.forEach((member) => {
      memberIds.push(member.userId);
      userNames[member.userId] =
        member.user.firstName || member.user.username || "Участник";
      userAvatars[member.userId] = member.user.avatarUrl || null;
      if (!member.isActive) {
        inactiveMembers[member.userId] = true;
      }
    });

    // Считаем долги между парами: debts[должник][кредитор] = сумма
    const debts: Record<string, Record<string, number>> = {};
    memberIds.forEach((id) => {
      debts[id] = {};
    });

    group.expenses.forEach((expense) => {
      const shares = expense.shares.map((s) => ({
        userId: s.userId,
        paid: Number(s.paid),
        owed: Number(s.owed),
      }));

      const totalPaid = shares.reduce((sum, s) => sum + s.paid, 0);
      if (totalPaid === 0) return;

      // Для каждого должника распределяем его долг пропорционально между плательщиками
      shares.forEach((debtor) => {
        if (debtor.owed <= 0) return;
        shares.forEach((payer) => {
          if (payer.paid <= 0 || debtor.userId === payer.userId) return;
          // Доля плательщика в общей сумме оплаты
          const payerShare = payer.paid / totalPaid;
          // Сколько должник должен этому плательщику
          const debtAmount = debtor.owed * payerShare;
          if (debtAmount > 0) {
            debts[debtor.userId][payer.userId] =
              (debts[debtor.userId][payer.userId] || 0) + debtAmount;
          }
        });
      });
    });

    // Учитываем погашения (settlements) — уменьшают долг
    group.settlements.forEach((settlement) => {
      const from = settlement.fromUserId;
      const to = settlement.toUserId;
      const amount = Number(settlement.amount);
      // Погашение: from заплатил to, значит долг from перед to уменьшается
      if (debts[from] && debts[from][to]) {
        debts[from][to] = Math.max(0, debts[from][to] - amount);
      }
    });

    // Взаимозачёт: если A должен B 300, а B должен A 2600, то A должен 0, B должен 2300
    const netDebts: Record<string, Record<string, number>> = {};
    memberIds.forEach((id) => {
      netDebts[id] = {};
    });

    for (const debtor of memberIds) {
      for (const creditor of memberIds) {
        if (debtor === creditor) continue;
        const owes = debts[debtor][creditor] || 0;
        const owedBack = debts[creditor][debtor] || 0;
        const net = owes - owedBack;
        if (net > 0) {
          netDebts[debtor][creditor] = net;
        }
      }
    }

    // Итоговый баланс для отображения
    const balances: Record<string, number> = {};
    memberIds.forEach((id) => {
      let balance = 0;
      // Сколько мне должны (сумма netDebts[other][id])
      memberIds.forEach((other) => {
        balance += netDebts[other][id] || 0;
      });
      // Сколько я должен (сумма netDebts[id][other])
      memberIds.forEach((other) => {
        balance -= netDebts[id][other] || 0;
      });
      balances[id] = balance;
    });

    // Формируем список долгов для отображения
    const debtsList: {
      fromUserId: string;
      toUserId: string;
      amount: number;
    }[] = [];
    for (const debtor of memberIds) {
      for (const creditor of memberIds) {
        const amount = netDebts[debtor][creditor] || 0;
        if (amount > 0.01) {
          debtsList.push({ fromUserId: debtor, toUserId: creditor, amount });
        }
      }
    }

    return {
      group: {
        id: group.id,
        name: group.name,
        imageUrl: group.imageUrl,
        currency: group.settlementCurrency,
        settlementCurrency: group.settlementCurrency,
        homeCurrency: group.homeCurrency,
        inviteCode: group.inviteCode,
        homeFxRate: fxInfo.homeFxRate,
        homeFxDate: fxInfo.homeFxDate?.toISOString(),
        homeFxSource: fxInfo.homeFxSource,
      },
      balances,
      userNames,
      userAvatars,
      inactiveMembers,
      debts: debtsList,
      expensesCount: group.expenses.length,
    };
  }

  async update(
    userId: string,
    groupId: string,
    dto: {
      name?: string;
      settlementCurrency?: string;
      homeCurrency?: string;
      fxMode?: string;
      fixedFxRates?: any;
      fixedFxDate?: string;
      fixedFxSource?: string;
    },
    image?: Express.Multer.File
  ) {
    // Проверяем, что пользователь создатель группы
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) throw new NotFoundException("Группа не найдена");
    if (group.createdById !== userId) {
      throw new ForbiddenException(
        "Только создатель может редактировать группу"
      );
    }

    let imageUrl: string | undefined;
    if (image) {
      if (group.imageUrl) {
        await this.uploadService.deleteGroupImage(groupId);
      }
      imageUrl = await this.uploadService.uploadGroupImage(image, groupId);
    }

    if (dto.settlementCurrency && dto.settlementCurrency !== group.settlementCurrency) {
      const [expensesCount, settlementsCount] = await Promise.all([
        this.prisma.expense.count({ where: { groupId } }),
        this.prisma.settlement.count({ where: { groupId } }),
      ]);
      if (expensesCount > 0 || settlementsCount > 0) {
        throw new ConflictException(
          "Нельзя менять валюту расчётов, если в группе уже есть операции"
        );
      }
    }

    const fixedFxDate = dto.fixedFxDate ? new Date(dto.fixedFxDate) : undefined;
    const fxMode =
      dto.fxMode && (dto.fxMode === "FIXED" ? GroupFxMode.FIXED : undefined);

    // Сбрасываем кэш курсов при смене любой валюты
    const currencyChanged =
      (dto.settlementCurrency && dto.settlementCurrency !== group.settlementCurrency) ||
      (dto.homeCurrency !== undefined && dto.homeCurrency !== group.homeCurrency);

    return this.prisma.group.update({
      where: { id: groupId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.settlementCurrency && { settlementCurrency: dto.settlementCurrency }),
        ...(dto.homeCurrency !== undefined && { homeCurrency: dto.homeCurrency }),
        ...(fxMode && { fxMode }),
        ...(dto.fixedFxRates !== undefined && { fixedFxRates: dto.fixedFxRates }),
        ...(fixedFxDate && { fixedFxDate }),
        ...(dto.fixedFxSource !== undefined && { fixedFxSource: dto.fixedFxSource }),
        ...(imageUrl && { imageUrl }),
        // Сбрасываем кэш курсов при смене валюты
        ...(currencyChanged && {
          fixedFxRates: null,
          fixedFxDate: null,
          fixedFxSource: null,
        }),
      },
    });
  }

  async delete(userId: string, groupId: string) {
    // Проверяем, что пользователь создатель группы
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) throw new NotFoundException("Группа не найдена");
    if (group.createdById !== userId) {
      throw new ForbiddenException("Только создатель может удалить группу");
    }

    // Удаляем изображение из S3
    if (group.imageUrl) {
      try {
        await this.uploadService.deleteGroupImage(groupId);
      } catch {
        // ignore
      }
    }

    // Удаляем все связанные данные
    await this.prisma.$transaction([
      this.prisma.expenseShare.deleteMany({
        where: { expense: { groupId } },
      }),
      this.prisma.expense.deleteMany({
        where: { groupId },
      }),
      this.prisma.settlement.deleteMany({
        where: { groupId },
      }),
      this.prisma.entitlement.deleteMany({
        where: { groupId },
      }),
      this.prisma.purchase.deleteMany({
        where: { groupId },
      }),
      this.prisma.groupMember.deleteMany({
        where: { groupId },
      }),
      this.prisma.group.delete({
        where: { id: groupId },
      }),
    ]);

    return { success: true };
  }

  async closeGroup(userId: string, groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, createdById: true, closedAt: true },
    });
    if (!group) throw new NotFoundException("Группа не найдена");
    if (group.createdById !== userId) {
      throw new ForbiddenException("Только создатель может закрыть поездку");
    }
    if (group.closedAt) {
      throw new ConflictException("Группа уже закрыта");
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.group.update({
        where: { id: groupId },
        data: { closedAt: now, lastActivityAt: now },
      }),
      this.prisma.entitlement.updateMany({
        where: {
          groupId,
          productCode: TRIP_PASS_PRODUCT_CODE,
          endsAt: { gt: now },
        },
        data: { endsAt: now },
      }),
    ]);

    return { success: true };
  }

  /**
   * Возвращает итоги поездки (Trip Summary).
   * Доступ: Trip Pass активен ИЛИ группа закрыта.
   */
  async getTripSummary(userId: string, groupId: string) {
    // Проверяем членство (допускаем и inactive)
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { id: true },
    });
    if (!member) {
      throw new ForbiddenException("Вы не состоите в этой группе");
    }

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        expenses: { include: { shares: true } },
        members: { include: { user: true } },
        settlements: true,
      },
    });
    if (!group) throw new NotFoundException("Группа не найдена");

    // Подтягиваем FX для домашней валюты (расширенная логика)
    const fxInfo = await this.ensureHomeFxRateForSummary(groupId);

    // Собираем участников
    const userNames: Record<string, string> = {};
    const userAvatars: Record<string, string | null> = {};
    const memberIds: string[] = [];

    group.members.forEach((m) => {
      memberIds.push(m.userId);
      userNames[m.userId] = m.user.firstName || m.user.username || "Участник";
      userAvatars[m.userId] = m.user.avatarUrl || null;
    });

    // === Расчёт балансов (аналогично getBalance) ===
    const debts: Record<string, Record<string, number>> = {};
    memberIds.forEach((id) => {
      debts[id] = {};
    });

    group.expenses.forEach((expense) => {
      const shares = expense.shares.map((s) => ({
        userId: s.userId,
        paid: Number(s.paid),
        owed: Number(s.owed),
      }));
      const totalPaid = shares.reduce((sum, s) => sum + s.paid, 0);
      if (totalPaid === 0) return;

      shares.forEach((debtor) => {
        if (debtor.owed <= 0) return;
        shares.forEach((payer) => {
          if (payer.paid <= 0 || debtor.userId === payer.userId) return;
          const payerShare = payer.paid / totalPaid;
          const debtAmount = debtor.owed * payerShare;
          if (debtAmount > 0) {
            debts[debtor.userId][payer.userId] =
              (debts[debtor.userId][payer.userId] || 0) + debtAmount;
          }
        });
      });
    });

    group.settlements.forEach((settlement) => {
      const from = settlement.fromUserId;
      const to = settlement.toUserId;
      const amount = Number(settlement.amount);
      if (debts[from] && debts[from][to]) {
        debts[from][to] = Math.max(0, debts[from][to] - amount);
      }
    });

    // Взаимозачёт
    const netDebts: Record<string, Record<string, number>> = {};
    memberIds.forEach((id) => {
      netDebts[id] = {};
    });
    for (const debtor of memberIds) {
      for (const creditor of memberIds) {
        if (debtor === creditor) continue;
        const owes = debts[debtor][creditor] || 0;
        const owedBack = debts[creditor][debtor] || 0;
        const net = owes - owedBack;
        if (net > 0) {
          netDebts[debtor][creditor] = net;
        }
      }
    }

    // Итоговый баланс
    const balances: Record<string, number> = {};
    memberIds.forEach((id) => {
      let balance = 0;
      memberIds.forEach((other) => {
        balance += netDebts[other][id] || 0;
      });
      memberIds.forEach((other) => {
        balance -= netDebts[id][other] || 0;
      });
      balances[id] = balance;
    });

    // === yourTripTotal: сумма owed текущего пользователя ===
    let yourTripTotal = 0;
    group.expenses.forEach((expense) => {
      expense.shares.forEach((share) => {
        if (share.userId === userId) {
          yourTripTotal += Number(share.owed);
        }
      });
    });

    // === spendingStats ===
    let groupTotalSpent = 0;
    const spendingByDay: Record<string, number> = {};

    group.expenses.forEach((expense) => {
      const amount = Number(expense.settlementAmount);
      groupTotalSpent += amount;

      const dayKey = expense.createdAt.toISOString().slice(0, 10);
      spendingByDay[dayKey] = (spendingByDay[dayKey] || 0) + amount;
    });

    const avgPerPerson = memberIds.length > 0 ? groupTotalSpent / memberIds.length : 0;

    // avgPerDay: по количеству уникальных дней с тратами
    const dayKeys = Object.keys(spendingByDay);
    const avgPerDay = dayKeys.length > 0 ? groupTotalSpent / dayKeys.length : 0;

    // mostExpensiveDay
    let mostExpensiveDay: { date: string; amount: number } | null = null;
    for (const [date, amount] of Object.entries(spendingByDay)) {
      if (!mostExpensiveDay || amount > mostExpensiveDay.amount) {
        mostExpensiveDay = { date, amount };
      }
    }

    // === roles ===
    // topPayer: макс сумма paid
    const paidByUser: Record<string, number> = {};
    const participationCount: Record<string, number> = {};

    group.expenses.forEach((expense) => {
      expense.shares.forEach((share) => {
        const uid = share.userId;
        paidByUser[uid] = (paidByUser[uid] || 0) + Number(share.paid);
        if (Number(share.owed) > 0) {
          participationCount[uid] = (participationCount[uid] || 0) + 1;
        }
      });
    });

    let topPayer: { userId: string; amount: number } | null = null;
    for (const [uid, amount] of Object.entries(paidByUser)) {
      if (!topPayer || amount > topPayer.amount) {
        topPayer = { userId: uid, amount };
      }
    }

    // mostFrequentParticipant
    let mostFrequentParticipant: { userId: string; count: number } | null = null;
    for (const [uid, count] of Object.entries(participationCount)) {
      if (!mostFrequentParticipant || count > mostFrequentParticipant.count) {
        mostFrequentParticipant = { userId: uid, count };
      }
    }

    // topDebtor / topCreditor (по net-балансу)
    let topDebtor: { userId: string; amount: number } | null = null;
    let topCreditor: { userId: string; amount: number } | null = null;
    for (const [uid, balance] of Object.entries(balances)) {
      if (balance < 0) {
        const absAmount = Math.abs(balance);
        if (!topDebtor || absAmount > topDebtor.amount) {
          topDebtor = { userId: uid, amount: absAmount };
        }
      } else if (balance > 0) {
        if (!topCreditor || balance > topCreditor.amount) {
          topCreditor = { userId: uid, amount: balance };
        }
      }
    }

    // === finalPlan: минимальный план переводов (greedy) ===
    const finalPlan = this.computeMinimalTransferPlan(balances);

    // === homeApprox ===
    let homeApprox: number | undefined;
    if (
      fxInfo.homeFxRate &&
      group.homeCurrency &&
      group.homeCurrency !== group.settlementCurrency
    ) {
      homeApprox = yourTripTotal * fxInfo.homeFxRate;
    }

    return {
      header: {
        yourTripTotal,
        tripCurrency: group.settlementCurrency,
        homeCurrency: group.homeCurrency || undefined,
        homeApprox,
        homeFxRate: fxInfo.homeFxRate,
      },
      spendingStats: {
        groupTotalSpent,
        avgPerPerson,
        avgPerDay,
        mostExpensiveDay,
        expensesCount: group.expenses.filter(e => !e.isSystem).length,
      },
      roles: {
        topPayer: topPayer
          ? { userId: topPayer.userId, name: userNames[topPayer.userId], amount: topPayer.amount }
          : null,
        mostFrequentParticipant: mostFrequentParticipant
          ? {
              userId: mostFrequentParticipant.userId,
              name: userNames[mostFrequentParticipant.userId],
              count: mostFrequentParticipant.count,
            }
          : null,
        topDebtor: topDebtor
          ? { userId: topDebtor.userId, name: userNames[topDebtor.userId], amount: topDebtor.amount }
          : null,
        topCreditor: topCreditor
          ? { userId: topCreditor.userId, name: userNames[topCreditor.userId], amount: topCreditor.amount }
          : null,
      },
      finalPlan: finalPlan.map((t) => ({
        fromUserId: t.fromUserId,
        fromName: userNames[t.fromUserId],
        toUserId: t.toUserId,
        toName: userNames[t.toUserId],
        amount: t.amount,
      })),
      charts: {
        // Траты по дням (для bar chart)
        dailySpending: Object.entries(spendingByDay)
          .map(([date, amount]) => ({ date, amount }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        // Траты по участникам (для pie chart)
        spendingByMember: memberIds.map((uid) => ({
          userId: uid,
          name: userNames[uid],
          paid: paidByUser[uid] || 0,
        })),
      },
      meta: {
        members: memberIds.map((uid) => ({
          id: uid,
          name: userNames[uid],
          avatarUrl: userAvatars[uid],
        })),
        closedAt: group.closedAt?.toISOString() || null,
        canClose: group.createdById === userId && !group.closedAt,
      },
    };
  }

  /**
   * Расширенная версия ensureHomeFxRate для итогов:
   * работает если Trip Pass активен ИЛИ группа закрыта.
   */
  private async ensureHomeFxRateForSummary(groupId: string): Promise<{
    homeFxRate?: number;
    homeFxDate?: Date;
    homeFxSource?: string;
  }> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: {
        homeCurrency: true,
        settlementCurrency: true,
        fixedFxRates: true,
        fixedFxDate: true,
        fixedFxSource: true,
        closedAt: true,
      },
    });
    if (!group) return {};

    const { homeCurrency, settlementCurrency, fixedFxRates, fixedFxDate, fixedFxSource, closedAt } = group;

    if (!homeCurrency || homeCurrency === settlementCurrency) {
      return {};
    }

    const rates = (fixedFxRates ?? {}) as Record<string, number>;
    const existingRate = rates[homeCurrency];

    if (existingRate && existingRate > 0) {
      return {
        homeFxRate: existingRate,
        homeFxDate: fixedFxDate ?? undefined,
        homeFxSource: fixedFxSource ?? undefined,
      };
    }

    // Проверяем доступ: Trip Pass активен ИЛИ группа закрыта
    const now = new Date();
    const entitlement = await this.prisma.entitlement.findFirst({
      where: {
        groupId,
        productCode: TRIP_PASS_PRODUCT_CODE,
        endsAt: { gt: now },
      },
      select: { id: true },
    });
    if (!entitlement && !closedAt) {
      return {};
    }

    // Запрашиваем курс
    try {
      const url = `${FX_PROVIDER_URL}/${settlementCurrency}`;
      const response = await fetch(url);
      if (!response.ok) return {};
      const data = (await response.json()) as {
        result?: string;
        rates?: Record<string, number>;
      };
      if (data.result !== "success" || !data.rates) return {};
      const fetchedRate = data.rates[homeCurrency];
      if (!fetchedRate || fetchedRate <= 0) return {};

      const newRates = { ...rates, [homeCurrency]: fetchedRate };
      const fetchDate = new Date();
      await this.prisma.group.update({
        where: { id: groupId },
        data: {
          fixedFxRates: newRates,
          fixedFxDate: fetchDate,
          fixedFxSource: "open.er-api.com",
        },
      });

      return {
        homeFxRate: fetchedRate,
        homeFxDate: fetchDate,
        homeFxSource: "open.er-api.com",
      };
    } catch {
      return {};
    }
  }

  /**
   * Greedy алгоритм минимального плана переводов.
   * Вход: balances[userId] = net balance (+ кредитор, - должник).
   * Выход: список переводов {fromUserId, toUserId, amount}.
   */
  private computeMinimalTransferPlan(
    balances: Record<string, number>
  ): { fromUserId: string; toUserId: string; amount: number }[] {
    const debtors: { userId: string; amount: number }[] = [];
    const creditors: { userId: string; amount: number }[] = [];

    for (const [userId, balance] of Object.entries(balances)) {
      if (balance < -0.01) {
        debtors.push({ userId, amount: Math.abs(balance) });
      } else if (balance > 0.01) {
        creditors.push({ userId, amount: balance });
      }
    }

    // Сортируем по убыванию суммы
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const transfers: { fromUserId: string; toUserId: string; amount: number }[] = [];

    let di = 0;
    let ci = 0;
    while (di < debtors.length && ci < creditors.length) {
      const debtor = debtors[di];
      const creditor = creditors[ci];
      const transfer = Math.min(debtor.amount, creditor.amount);

      if (transfer > 0.01) {
        transfers.push({
          fromUserId: debtor.userId,
          toUserId: creditor.userId,
          amount: Math.round(transfer * 100) / 100,
        });
      }

      debtor.amount -= transfer;
      creditor.amount -= transfer;

      if (debtor.amount < 0.01) di++;
      if (creditor.amount < 0.01) ci++;
    }

    return transfers;
  }
}
