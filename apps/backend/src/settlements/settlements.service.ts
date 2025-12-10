import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSettlementDto } from "./dto/create-settlement.dto";

@Injectable()
export class SettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(fromUserId: string, dto: CreateSettlementDto) {
    return this.prisma.settlement.create({
      data: {
        fromUserId,
        toUserId: dto.toUserId,
        groupId: dto.groupId,
        amount: dto.amount,
        currency: dto.currency ?? "USD",
        note: dto.note,
      },
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
