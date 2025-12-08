import { Injectable, NotFoundException } from '@nestjs/common';
import { GroupRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      include: { group: true }
    });

    return memberships.map((member) => ({
      id: member.group.id,
      name: member.group.name,
      currency: member.group.currency,
      role: member.role
    }));
  }

  async create(userId: string, dto: CreateGroupDto) {
    const memberIds = Array.from(new Set([userId, ...(dto.memberIds ?? [])]));
    const group = await this.prisma.group.create({
      data: {
        name: dto.name,
        currency: dto.currency ?? 'USD',
        createdById: userId,
        members: {
          create: memberIds.map((id) => ({
            userId: id,
            role: id === userId ? GroupRole.ADMIN : GroupRole.MEMBER
          }))
        }
      },
      include: { members: true }
    });
    return group;
  }

  async getBalance(groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { expenses: { include: { shares: true } } }
    });
    if (!group) throw new NotFoundException('Group not found');

    const balances: Record<string, number> = {};
    group.expenses.forEach((expense) => {
      expense.shares.forEach((share) => {
        balances[share.userId] = (balances[share.userId] ?? 0) + Number(share.paid) - Number(share.owed);
      });
    });

    return {
      group: { id: group.id, name: group.name, currency: group.currency },
      balances,
      expensesCount: group.expenses.length
    };
  }
}

