import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { AdminRole, PurchaseStatus } from '@prisma/client';

@Injectable()
export class AdminSalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
  ) {}

  async listPurchases(params: {
    page?: number;
    limit?: number;
    status?: PurchaseStatus;
    productCode?: string;
    userId?: string;
    groupId?: string;
    from?: Date;
    to?: Date;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.productCode) where.productCode = params.productCode;
    if (params.userId) where.buyerUserId = params.userId;
    if (params.groupId) where.groupId = params.groupId;
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = params.from;
      if (params.to) where.createdAt.lte = params.to;
    }

    const [items, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          product: { select: { code: true, title: true } },
          buyer: { select: { id: true, telegramId: true, firstName: true, lastName: true } },
          group: { select: { id: true, name: true } },
          entitlement: { select: { id: true, endsAt: true } },
        },
      }),
      this.prisma.purchase.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getPurchase(id: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: {
        product: true,
        buyer: { select: { id: true, telegramId: true, firstName: true, lastName: true, username: true } },
        group: { select: { id: true, name: true, settlementCurrency: true } },
        entitlement: true,
      },
    });
    if (!purchase) throw new NotFoundException('Покупка не найдена');

    // Проверяем, создана ли системная трата
    const systemExpense = await this.prisma.expense.findUnique({
      where: { purchaseId: id },
      select: { id: true, description: true, settlementAmount: true },
    });

    return { ...purchase, systemExpense };
  }

  async markReviewed(
    purchaseId: string,
    note: string,
    admin: { id: string; role: AdminRole },
    ip?: string,
    userAgent?: string,
  ) {
    const purchase = await this.prisma.purchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) throw new NotFoundException('Покупка не найдена');

    // Записываем в аудит как "просмотрено/разобрано"
    await this.auditService.log({
      adminId: admin.id,
      adminRole: admin.role,
      action: 'MARK_PURCHASE_REVIEWED',
      targetType: 'Purchase',
      targetId: purchaseId,
      before: null,
      after: { note },
      reason: note,
      ip,
      userAgent,
    });

    return { success: true };
  }

  async getSalesStats(params: { from?: Date; to?: Date }) {
    const where: any = { status: 'PAID' };
    if (params.from || params.to) {
      where.paidAt = {};
      if (params.from) where.paidAt.gte = params.from;
      if (params.to) where.paidAt.lte = params.to;
    }

    const [totalPurchases, totalStars, failedCount, cancelledCount] = await Promise.all([
      this.prisma.purchase.count({ where }),
      this.prisma.purchase.aggregate({
        where,
        _sum: { starsAmount: true },
      }),
      this.prisma.purchase.count({
        where: {
          status: 'FAILED',
          ...(params.from || params.to ? { createdAt: where.paidAt } : {}),
        },
      }),
      this.prisma.purchase.count({
        where: {
          status: 'CANCELLED',
          ...(params.from || params.to ? { createdAt: where.paidAt } : {}),
        },
      }),
    ]);

    return {
      totalPurchases,
      totalStars: totalStars._sum.starsAmount || 0,
      failedCount,
      cancelledCount,
    };
  }
}

