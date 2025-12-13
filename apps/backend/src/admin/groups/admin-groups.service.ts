import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async listGroups(params: {
    page?: number;
    limit?: number;
    search?: string;
    closed?: boolean;
    hasTripPass?: boolean;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.search) {
      where.OR = [
        { id: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params.closed === true) {
      where.closedAt = { not: null };
    } else if (params.closed === false) {
      where.closedAt = null;
    }

    const now = new Date();

    const [items, total] = await Promise.all([
      this.prisma.group.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          imageUrl: true,
          settlementCurrency: true,
          closedAt: true,
          createdAt: true,
          createdById: true,
          _count: { select: { members: true, expenses: true } },
          entitlements: {
            where: { endsAt: { gt: now } },
            select: { id: true, endsAt: true, productCode: true },
            take: 1,
          },
        },
      }),
      this.prisma.group.count({ where }),
    ]);

    // Post-filter by hasTripPass if needed
    let filteredItems = items;
    if (params.hasTripPass === true) {
      filteredItems = items.filter(g => g.entitlements.length > 0);
    } else if (params.hasTripPass === false) {
      filteredItems = items.filter(g => g.entitlements.length === 0);
    }

    return {
      items: filteredItems.map(g => ({
        id: g.id,
        name: g.name,
        imageUrl: g.imageUrl,
        settlementCurrency: g.settlementCurrency,
        closedAt: g.closedAt,
        createdAt: g.createdAt,
        createdById: g.createdById,
        membersCount: g._count.members,
        expensesCount: g._count.expenses,
        tripPassActive: g.entitlements.length > 0,
        tripPassEndsAt: g.entitlements[0]?.endsAt || null,
      })),
      total,
      page,
      limit,
    };
  }

  async getGroup(id: string) {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, telegramId: true, firstName: true, lastName: true } },
        members: {
          include: {
            user: { select: { id: true, telegramId: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        entitlements: {
          include: { product: true, purchase: { select: { id: true, buyerUserId: true } } },
        },
        _count: { select: { expenses: true, settlements: true } },
      },
    });
    if (!group) throw new NotFoundException('Группа не найдена');

    return {
      ...group,
      expensesCount: group._count.expenses,
      settlementsCount: group._count.settlements,
    };
  }
}


