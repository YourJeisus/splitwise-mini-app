import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        description: dto.description,
        amount: dto.amount,
        currency: dto.currency ?? 'USD',
        category: dto.category,
        groupId: dto.groupId,
        createdById: userId,
        shares: {
          create: dto.shares.map((share) => ({
            userId: share.userId,
            paid: share.paid,
            owed: share.owed
          }))
        }
      },
      include: { shares: true }
    });
  }

  async listByGroup(groupId: string) {
    return this.prisma.expense.findMany({
      where: { groupId },
      include: { shares: true },
      orderBy: { createdAt: 'desc' }
    });
  }
}

