import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSettlementDto } from "./dto/create-settlement.dto";

@Injectable()
export class SettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(fromUserId: string, dto: CreateSettlementDto) {
    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
      select: { settlementCurrency: true, closedAt: true },
    });
    if (!group) {
      throw new NotFoundException("Группа не найдена");
    }
    if (group.closedAt) {
      throw new BadRequestException("Группа закрыта");
    }
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.settlement.create({
        data: {
          fromUserId,
          toUserId: dto.toUserId,
          groupId: dto.groupId,
          amount: dto.amount,
          currency: group?.settlementCurrency ?? "USD",
          note: dto.note,
        },
      });
      await tx.group.update({
        where: { id: dto.groupId },
        data: { lastActivityAt: now },
      });
      return created;
    });
  }

  async list(userId: string) {
    return this.prisma.settlement.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
