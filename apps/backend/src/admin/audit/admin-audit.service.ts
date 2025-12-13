import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminRole } from '@prisma/client';

export interface AuditLogParams {
  adminId: string;
  adminRole: AdminRole;
  action: string;
  targetType: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  reason: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: AuditLogParams) {
    return this.prisma.adminAuditLog.create({
      data: {
        adminId: params.adminId,
        adminRole: params.adminRole,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        before: params.before as any,
        after: params.after as any,
        reason: params.reason,
        ip: params.ip,
        userAgent: params.userAgent,
      },
    });
  }

  async list(params: {
    page?: number;
    limit?: number;
    adminId?: string;
    targetType?: string;
    targetId?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.adminId) where.adminId = params.adminId;
    if (params.targetType) where.targetType = params.targetType;
    if (params.targetId) where.targetId = params.targetId;

    const [items, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          admin: { select: { id: true, email: true, role: true } },
        },
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}


