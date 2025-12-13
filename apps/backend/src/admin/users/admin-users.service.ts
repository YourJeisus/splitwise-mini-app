import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { AdminRole } from '@prisma/client';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
  ) {}

  async listUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    godMode?: boolean;
    hasTripPass?: boolean;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.search) {
      where.OR = [
        { id: { contains: params.search, mode: 'insensitive' } },
        { telegramId: { contains: params.search, mode: 'insensitive' } },
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
        { username: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params.godMode !== undefined) {
      where.godModeEnabled = params.godMode;
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          telegramId: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          godModeEnabled: true,
          lastActiveAt: true,
          createdAt: true,
          _count: {
            select: { purchases: true, groupMembers: true },
          },
          groupMembers: {
            select: { groupId: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Подсчитываем активные Trip Pass для каждого пользователя
    const now = new Date();
    const allGroupIds = items.flatMap(u => u.groupMembers.map(gm => gm.groupId));
    const activeEntitlements = await this.prisma.entitlement.findMany({
      where: {
        groupId: { in: allGroupIds },
        productCode: 'TRIP_PASS_30D',
        endsAt: { gt: now },
      },
      select: { groupId: true },
    });
    const groupsWithTripPass = new Set(activeEntitlements.map(e => e.groupId));

    const itemsWithTripPassCount = items.map(u => {
      const activeTripPasses = u.groupMembers.filter(gm => groupsWithTripPass.has(gm.groupId)).length;
      const { groupMembers: _, ...rest } = u;
      return { ...rest, activeTripPasses };
    });

    return { items: itemsWithTripPassCount, total, page, limit };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        purchases: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { product: true, entitlement: true },
        },
        groupMembers: {
          include: {
            group: {
              select: { id: true, name: true, settlementCurrency: true, closedAt: true },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');

    // Получаем активные entitlements для пользователя через его группы
    const now = new Date();
    const groupIds = user.groupMembers.map(gm => gm.groupId);
    const entitlements = await this.prisma.entitlement.findMany({
      where: {
        groupId: { in: groupIds },
        endsAt: { gt: now },
      },
      include: { product: true, group: { select: { id: true, name: true } } },
    });

    return { ...user, activeEntitlements: entitlements };
  }

  async toggleGodMode(
    userId: string,
    enabled: boolean,
    admin: { id: string; role: AdminRole },
    reason: string,
    ip?: string,
    userAgent?: string,
  ) {
    const before = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, godModeEnabled: true },
    });
    if (!before) throw new NotFoundException('Пользователь не найден');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { godModeEnabled: enabled },
      select: { id: true, godModeEnabled: true },
    });

    await this.auditService.log({
      adminId: admin.id,
      adminRole: admin.role,
      action: enabled ? 'ENABLE_GOD_MODE' : 'DISABLE_GOD_MODE',
      targetType: 'User',
      targetId: userId,
      before,
      after: updated,
      reason,
      ip,
      userAgent,
    });

    return updated;
  }

  async grantEntitlement(
    userId: string,
    data: {
      groupId: string;
      productCode: string;
      durationDays: number;
    },
    admin: { id: string; role: AdminRole },
    reason: string,
    ip?: string,
    userAgent?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const group = await this.prisma.group.findUnique({ where: { id: data.groupId } });
    if (!group) throw new NotFoundException('Группа не найдена');

    const product = await this.prisma.product.findUnique({ where: { code: data.productCode } });
    if (!product) throw new NotFoundException('Продукт не найден');

    const now = new Date();
    const endsAt = new Date(now.getTime() + data.durationDays * 24 * 60 * 60 * 1000);

    // Создаём фиктивный purchase для admin entitlement
    const purchase = await this.prisma.purchase.create({
      data: {
        productCode: data.productCode,
        groupId: data.groupId,
        buyerUserId: userId,
        invoicePayload: `admin_grant_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        starsAmount: 0,
        currency: 'XTR',
        status: 'PAID',
        splitCost: false,
        settlementFeeAmount: 0,
        settlementCurrency: group.settlementCurrency,
        paidAt: now,
        pricingSnapshot: { grantedByAdmin: admin.id, reason },
      },
    });

    const entitlement = await this.prisma.entitlement.create({
      data: {
        groupId: data.groupId,
        productCode: data.productCode,
        startsAt: now,
        endsAt,
        purchaseId: purchase.id,
      },
      include: { product: true, group: { select: { id: true, name: true } } },
    });

    await this.auditService.log({
      adminId: admin.id,
      adminRole: admin.role,
      action: 'GRANT_ENTITLEMENT',
      targetType: 'Entitlement',
      targetId: entitlement.id,
      before: null,
      after: entitlement,
      reason,
      ip,
      userAgent,
    });

    return entitlement;
  }

  async revokeEntitlement(
    entitlementId: string,
    admin: { id: string; role: AdminRole },
    reason: string,
    ip?: string,
    userAgent?: string,
  ) {
    const before = await this.prisma.entitlement.findUnique({
      where: { id: entitlementId },
      include: { product: true, group: { select: { id: true, name: true } } },
    });
    if (!before) throw new NotFoundException('Entitlement не найден');

    // Устанавливаем endsAt в прошлое
    const updated = await this.prisma.entitlement.update({
      where: { id: entitlementId },
      data: { endsAt: new Date(0) },
    });

    await this.auditService.log({
      adminId: admin.id,
      adminRole: admin.role,
      action: 'REVOKE_ENTITLEMENT',
      targetType: 'Entitlement',
      targetId: entitlementId,
      before,
      after: updated,
      reason,
      ip,
      userAgent,
    });

    return { success: true };
  }

  async extendEntitlement(
    entitlementId: string,
    extraDays: number,
    admin: { id: string; role: AdminRole },
    reason: string,
    ip?: string,
    userAgent?: string,
  ) {
    const before = await this.prisma.entitlement.findUnique({
      where: { id: entitlementId },
    });
    if (!before) throw new NotFoundException('Entitlement не найден');

    const newEndsAt = new Date(Math.max(before.endsAt.getTime(), Date.now()) + extraDays * 24 * 60 * 60 * 1000);
    const updated = await this.prisma.entitlement.update({
      where: { id: entitlementId },
      data: { endsAt: newEndsAt },
    });

    await this.auditService.log({
      adminId: admin.id,
      adminRole: admin.role,
      action: 'EXTEND_ENTITLEMENT',
      targetType: 'Entitlement',
      targetId: entitlementId,
      before,
      after: updated,
      reason,
      ip,
      userAgent,
    });

    return updated;
  }
}

