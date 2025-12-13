import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateTrackingLinkDto } from "./dto/create-tracking-link.dto";
import { UpdateTrackingLinkDto } from "./dto/update-tracking-link.dto";

@Injectable()
export class AdminTrackingService {
  constructor(private prisma: PrismaService) {}

  async list(params: { page?: number; search?: string; enabled?: boolean }) {
    const { page = 1, search, enabled } = params;
    const limit = 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }
    if (enabled !== undefined) {
      where.enabled = enabled;
    }

    const [items, total] = await Promise.all([
      this.prisma.trackingLink.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.trackingLink.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getById(id: string) {
    const link = await this.prisma.trackingLink.findUnique({
      where: { id },
      include: {
        _count: { select: { clicks: true } },
      },
    });
    if (!link) throw new NotFoundException("Tracking link not found");
    return link;
  }

  async getStats(id: string, params: { from?: string; to?: string }) {
    const link = await this.prisma.trackingLink.findUnique({ where: { id } });
    if (!link) throw new NotFoundException("Tracking link not found");

    const where: any = { trackingLinkId: id };
    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) where.createdAt.lte = new Date(params.to);
    }

    const clicksByDay = await this.prisma.trackingLinkClick.groupBy({
      by: ["createdAt"],
      where,
      _count: true,
    });

    const uniqueUsers = await this.prisma.trackingLinkClick.groupBy({
      by: ["telegramUserId"],
      where: { ...where, telegramUserId: { not: null } },
    });

    const recentClicks = await this.prisma.trackingLinkClick.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return {
      link,
      totalClicks: link.clickCount,
      uniqueUsersCount: uniqueUsers.length,
      recentClicks,
    };
  }

  async create(dto: CreateTrackingLinkDto) {
    const existing = await this.prisma.trackingLink.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(
        "Tracking link with this code already exists"
      );
    }

    return this.prisma.trackingLink.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        enabled: dto.enabled ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateTrackingLinkDto) {
    const link = await this.prisma.trackingLink.findUnique({ where: { id } });
    if (!link) throw new NotFoundException("Tracking link not found");

    return this.prisma.trackingLink.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        enabled: dto.enabled,
      },
    });
  }

  async delete(id: string) {
    const link = await this.prisma.trackingLink.findUnique({ where: { id } });
    if (!link) throw new NotFoundException("Tracking link not found");

    await this.prisma.trackingLink.delete({ where: { id } });
    return { success: true };
  }

  // Метод для записи клика (используется в bot.service)
  async recordClick(code: string, telegramUserId?: string) {
    const link = await this.prisma.trackingLink.findUnique({
      where: { code },
    });
    if (!link || !link.enabled) return null;

    await this.prisma.$transaction([
      this.prisma.trackingLinkClick.create({
        data: {
          trackingLinkId: link.id,
          telegramUserId,
        },
      }),
      this.prisma.trackingLink.update({
        where: { id: link.id },
        data: { clickCount: { increment: 1 } },
      }),
    ]);

    return link;
  }
}
