import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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
      ...expenses.map((e) => ({ ...e, type: "expense" as const })),
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
    dto: { description?: string; amount?: number; shares?: { userId: string; paid: number; owed: number }[] }
  ) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId }
    });
    
    if (!expense) throw new NotFoundException('Расход не найден');
    if (expense.createdById !== userId) {
      throw new ForbiddenException('Только создатель может редактировать расход');
    }

    // Если обновляются shares, удаляем старые и создаём новые
    if (dto.shares) {
      await this.prisma.expenseShare.deleteMany({
        where: { expenseId }
      });
    }

    return this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...(dto.description && { description: dto.description }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.shares && {
          shares: {
            create: dto.shares.map((share) => ({
              userId: share.userId,
              paid: share.paid,
              owed: share.owed
            }))
          }
        })
      },
      include: { 
        shares: {
          include: {
            user: {
              select: { id: true, firstName: true, username: true }
            }
          }
        }
      }
    });
  }

  async delete(userId: string, expenseId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId }
    });
    
    if (!expense) throw new NotFoundException('Расход не найден');
    if (expense.createdById !== userId) {
      throw new ForbiddenException('Только создатель может удалить расход');
    }

    await this.prisma.$transaction([
      this.prisma.expenseShare.deleteMany({
        where: { expenseId }
      }),
      this.prisma.expense.delete({
        where: { id: expenseId }
      })
    ]);

    return { success: true };
  }
}

