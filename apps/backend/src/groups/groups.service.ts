import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { GroupRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateGroupDto } from "./dto/create-group.dto";

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

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
        currency: member.group.currency,
        inviteCode: member.group.inviteCode,
        createdById: member.group.createdById,
        role: member.role,
        userBalance,
      };
    });
  }

  async create(userId: string, dto: CreateGroupDto) {
    const group = await this.prisma.group.create({
      data: {
        name: dto.name,
        currency: dto.currency ?? "USD",
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
      currency: group.currency,
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
        await this.prisma.groupMember.update({
          where: { id: existing.id },
          data: { isActive: true, leftAt: null },
        });
        return { id: group.id, name: group.name, currency: group.currency };
      }
      throw new ConflictException("Вы уже в этой группе");
    }

    await this.prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: GroupRole.MEMBER,
      },
    });

    return { id: group.id, name: group.name, currency: group.currency };
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
        currency: group.currency,
        inviteCode: group.inviteCode,
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
    dto: { name?: string; currency?: string }
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

    return this.prisma.group.update({
      where: { id: groupId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.currency && { currency: dto.currency }),
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

    // Удаляем все связанные данные
    await this.prisma.$transaction([
      this.prisma.expenseShare.deleteMany({
        where: { expense: { groupId } },
      }),
      this.prisma.expense.deleteMany({
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
}
