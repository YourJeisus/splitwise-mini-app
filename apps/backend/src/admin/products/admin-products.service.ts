import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from '../audit/admin-audit.service';
import { AdminRole, DiscountType, Prisma } from '@prisma/client';

function toJsonValue(val: Record<string, number> | null | undefined): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (val === undefined) return undefined;
  if (val === null) return Prisma.DbNull;
  return val;
}

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
  ) {}

  async listProducts() {
    const products = await this.prisma.product.findMany({
      include: {
        pricing: true,
        promoCodes: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { code: 'asc' },
    });
    return products;
  }

  async getProduct(code: string) {
    const product = await this.prisma.product.findUnique({
      where: { code },
      include: {
        pricing: true,
        promoCodes: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!product) throw new NotFoundException('Продукт не найден');
    return product;
  }

  async updateProduct(
    code: string,
    data: {
      title?: string;
      starsPrice?: number;
      durationDays?: number;
      active?: boolean;
      priceBySettlementCurrency?: Record<string, number>;
    },
    admin: { id: string; role: AdminRole },
    reason: string,
    ip?: string,
    userAgent?: string,
  ) {
    const before = await this.prisma.product.findUnique({ where: { code } });
    if (!before) throw new NotFoundException('Продукт не найден');

    const updated = await this.prisma.product.update({
      where: { code },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.starsPrice !== undefined && { starsPrice: data.starsPrice }),
        ...(data.durationDays !== undefined && { durationDays: data.durationDays }),
        ...(data.active !== undefined && { active: data.active }),
        ...(data.priceBySettlementCurrency !== undefined && {
          priceBySettlementCurrency: data.priceBySettlementCurrency,
        }),
      },
    });

    await this.auditService.log({
      adminId: admin.id,
      adminRole: admin.role,
      action: 'UPDATE_PRODUCT',
      targetType: 'Product',
      targetId: code,
      before,
      after: updated,
      reason,
      ip,
      userAgent,
    });

    return updated;
  }

  async updateProductPricing(
    code: string,
    data: {
      globalDiscountType?: DiscountType;
      percentOff?: number | null;
      starsPriceOverride?: number | null;
      priceBySettlementCurrencyOverride?: Record<string, number> | null;
      enabled?: boolean;
    },
    admin: { id: string; role: AdminRole },
    reason: string,
    ip?: string,
    userAgent?: string,
  ) {
    const product = await this.prisma.product.findUnique({ where: { code } });
    if (!product) throw new NotFoundException('Продукт не найден');

    const before = await this.prisma.productPricing.findUnique({
      where: { productCode: code },
    });

    const jsonOverride = toJsonValue(data.priceBySettlementCurrencyOverride);
    const updated = await this.prisma.productPricing.upsert({
      where: { productCode: code },
      create: {
        productCode: code,
        globalDiscountType: data.globalDiscountType ?? 'NONE',
        percentOff: data.percentOff,
        starsPriceOverride: data.starsPriceOverride,
        priceBySettlementCurrencyOverride: jsonOverride ?? Prisma.DbNull,
        enabled: data.enabled ?? false,
      },
      update: {
        ...(data.globalDiscountType !== undefined && { globalDiscountType: data.globalDiscountType }),
        ...(data.percentOff !== undefined && { percentOff: data.percentOff }),
        ...(data.starsPriceOverride !== undefined && { starsPriceOverride: data.starsPriceOverride }),
        ...(jsonOverride !== undefined && { priceBySettlementCurrencyOverride: jsonOverride }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
      },
    });

    await this.auditService.log({
      adminId: admin.id,
      adminRole: admin.role,
      action: 'UPDATE_PRODUCT_PRICING',
      targetType: 'ProductPricing',
      targetId: code,
      before,
      after: updated,
      reason,
      ip,
      userAgent,
    });

    return updated;
  }

  async createPromoCode(
    data: {
      code: string;
      productCode: string;
      discountType: DiscountType;
      percentOff?: number;
      starsPriceOverride?: number;
      priceBySettlementCurrencyOverride?: Record<string, number>;
      enabled?: boolean;
      maxRedemptions?: number;
    },
    admin: { id: string; role: AdminRole },
    reason: string,
    ip?: string,
    userAgent?: string,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { code: data.productCode },
    });
    if (!product) throw new NotFoundException('Продукт не найден');

    const promo = await this.prisma.promoCode.create({
      data: {
        code: data.code,
        productCode: data.productCode,
        discountType: data.discountType,
        percentOff: data.percentOff,
        starsPriceOverride: data.starsPriceOverride,
        priceBySettlementCurrencyOverride: data.priceBySettlementCurrencyOverride,
        enabled: data.enabled ?? true,
        maxRedemptions: data.maxRedemptions,
      },
    });

    await this.auditService.log({
      adminId: admin.id,
      adminRole: admin.role,
      action: 'CREATE_PROMO_CODE',
      targetType: 'PromoCode',
      targetId: promo.id,
      before: null,
      after: promo,
      reason,
      ip,
      userAgent,
    });

    return promo;
  }

  async updatePromoCode(
    id: string,
    data: {
      enabled?: boolean;
      percentOff?: number | null;
      starsPriceOverride?: number | null;
      priceBySettlementCurrencyOverride?: Record<string, number> | null;
      maxRedemptions?: number | null;
    },
    admin: { id: string; role: AdminRole },
    reason: string,
    ip?: string,
    userAgent?: string,
  ) {
    const before = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Промокод не найден');

    const promoJsonOverride = toJsonValue(data.priceBySettlementCurrencyOverride);
    const updated = await this.prisma.promoCode.update({
      where: { id },
      data: {
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.percentOff !== undefined && { percentOff: data.percentOff }),
        ...(data.starsPriceOverride !== undefined && { starsPriceOverride: data.starsPriceOverride }),
        ...(promoJsonOverride !== undefined && { priceBySettlementCurrencyOverride: promoJsonOverride }),
        ...(data.maxRedemptions !== undefined && { maxRedemptions: data.maxRedemptions }),
      },
    });

    await this.auditService.log({
      adminId: admin.id,
      adminRole: admin.role,
      action: 'UPDATE_PROMO_CODE',
      targetType: 'PromoCode',
      targetId: id,
      before,
      after: updated,
      reason,
      ip,
      userAgent,
    });

    return updated;
  }

  async deletePromoCode(
    id: string,
    admin: { id: string; role: AdminRole },
    reason: string,
    ip?: string,
    userAgent?: string,
  ) {
    const before = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Промокод не найден');

    await this.prisma.promoCode.delete({ where: { id } });

    await this.auditService.log({
      adminId: admin.id,
      adminRole: admin.role,
      action: 'DELETE_PROMO_CODE',
      targetType: 'PromoCode',
      targetId: id,
      before,
      after: null,
      reason,
      ip,
      userAgent,
    });

    return { success: true };
  }
}

