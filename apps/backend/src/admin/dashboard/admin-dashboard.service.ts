import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getKPI(period: 'today' | '7d' | '30d') {
    const now = new Date();
    let from: Date;

    switch (period) {
      case 'today':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case '7d':
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
      default:
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const [
      revenue,
      purchasesCount,
      activeTripPassCount,
      totalUsers,
      activeUsersCount,
      activeGroupsCount,
      failedPayments,
      cancelledPayments,
      createdInvoices,
    ] = await Promise.all([
      // Revenue (Stars)
      this.prisma.purchase.aggregate({
        where: { status: 'PAID', paidAt: { gte: from } },
        _sum: { starsAmount: true },
      }),
      // Purchases count
      this.prisma.purchase.count({
        where: { status: 'PAID', paidAt: { gte: from } },
      }),
      // Active Trip Pass count
      this.prisma.entitlement.count({
        where: { endsAt: { gt: now } },
      }),
      // Total users
      this.prisma.user.count(),
      // Active users in period (lastActiveAt)
      this.prisma.user.count({
        where: { lastActiveAt: { gte: from } },
      }),
      // Active groups (not closed)
      this.prisma.group.count({
        where: { closedAt: null },
      }),
      // Failed payments
      this.prisma.purchase.count({
        where: { status: 'FAILED', createdAt: { gte: from } },
      }),
      // Cancelled payments
      this.prisma.purchase.count({
        where: { status: 'CANCELLED', createdAt: { gte: from } },
      }),
      // Created invoices (for conversion)
      this.prisma.purchase.count({
        where: { createdAt: { gte: from } },
      }),
    ]);

    // Conversion: created -> paid
    const paidInvoices = purchasesCount;
    const conversionRate = createdInvoices > 0 ? ((paidInvoices / createdInvoices) * 100).toFixed(1) : '0';

    return {
      period,
      from: from.toISOString(),
      to: now.toISOString(),
      revenue: {
        stars: revenue._sum.starsAmount || 0,
      },
      purchases: {
        count: purchasesCount,
        failed: failedPayments,
        cancelled: cancelledPayments,
      },
      tripPass: {
        activeCount: activeTripPassCount,
      },
      users: {
        total: totalUsers,
        activeInPeriod: activeUsersCount,
      },
      groups: {
        activeCount: activeGroupsCount,
      },
      conversion: {
        createdInvoices,
        paidInvoices,
        rate: `${conversionRate}%`,
      },
    };
  }
}









