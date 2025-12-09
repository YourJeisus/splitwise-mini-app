import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { GroupRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      include: { 
        group: {
          include: {
            expenses: { include: { shares: true } }
          }
        }
      }
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

      return {
        id: member.group.id,
        name: member.group.name,
        currency: member.group.currency,
        inviteCode: member.group.inviteCode,
        createdById: member.group.createdById,
        role: member.role,
        userBalance
      };
    });
  }

  async create(userId: string, dto: CreateGroupDto) {
    const group = await this.prisma.group.create({
      data: {
        name: dto.name,
        currency: dto.currency ?? 'USD',
        createdById: userId,
        members: {
          create: {
            userId,
            role: GroupRole.ADMIN
          }
        }
      },
      include: { members: true }
    });
    return group;
  }

  async getByInviteCode(inviteCode: string) {
    const group = await this.prisma.group.findUnique({
      where: { inviteCode },
      include: {
        _count: { select: { members: true } }
      }
    });
    if (!group) throw new NotFoundException('Группа не найдена');
    
    return {
      id: group.id,
      name: group.name,
      currency: group.currency,
      membersCount: group._count.members
    };
  }

  async joinByInvite(userId: string, inviteCode: string) {
    const group = await this.prisma.group.findUnique({
      where: { inviteCode }
    });
    if (!group) throw new NotFoundException('Группа не найдена');

    const existing = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId } }
    });
    if (existing) throw new ConflictException('Вы уже в этой группе');

    await this.prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: GroupRole.MEMBER
      }
    });

    return { id: group.id, name: group.name, currency: group.currency };
  }

  async getBalance(groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { 
        expenses: { include: { shares: true } },
        members: { include: { user: true } }
      }
    });
    if (!group) throw new NotFoundException('Group not found');

    const balances: Record<string, number> = {};
    const userNames: Record<string, string> = {};
    
    group.members.forEach((member) => {
      balances[member.userId] = 0;
      userNames[member.userId] = member.user.firstName || member.user.username || 'Участник';
    });

    group.expenses.forEach((expense) => {
      expense.shares.forEach((share) => {
        balances[share.userId] = (balances[share.userId] ?? 0) + Number(share.paid) - Number(share.owed);
      });
    });

    return {
      group: { id: group.id, name: group.name, currency: group.currency, inviteCode: group.inviteCode },
      balances,
      userNames,
      expensesCount: group.expenses.length
    };
  }

  async update(userId: string, groupId: string, dto: { name?: string; currency?: string }) {
    // Проверяем, что пользователь создатель группы
    const group = await this.prisma.group.findUnique({
      where: { id: groupId }
    });
    
    if (!group) throw new NotFoundException('Группа не найдена');
    if (group.createdById !== userId) {
      throw new ForbiddenException('Только создатель может редактировать группу');
    }

    return this.prisma.group.update({
      where: { id: groupId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.currency && { currency: dto.currency })
      }
    });
  }

  async delete(userId: string, groupId: string) {
    // Проверяем, что пользователь создатель группы
    const group = await this.prisma.group.findUnique({
      where: { id: groupId }
    });
    
    if (!group) throw new NotFoundException('Группа не найдена');
    if (group.createdById !== userId) {
      throw new ForbiddenException('Только создатель может удалить группу');
    }

    // Удаляем все связанные данные
    await this.prisma.$transaction([
      this.prisma.expenseShare.deleteMany({
        where: { expense: { groupId } }
      }),
      this.prisma.expense.deleteMany({
        where: { groupId }
      }),
      this.prisma.groupMember.deleteMany({
        where: { groupId }
      }),
      this.prisma.group.delete({
        where: { id: groupId }
      })
    ]);

    return { success: true };
  }
}

