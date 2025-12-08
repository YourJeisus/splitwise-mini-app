import { Injectable } from '@nestjs/common';
import { FriendshipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: userId, status: FriendshipStatus.ACCEPTED },
          { addresseeId: userId, status: FriendshipStatus.ACCEPTED }
        ]
      },
      include: {
        requester: true,
        addressee: true
      }
    });

    return friendships.map((f) => (f.requesterId === userId ? f.addressee : f.requester));
  }

  async addFriend(userId: string, telegramId: string) {
    const friend = await this.prisma.user.upsert({
      where: { telegramId },
      update: {},
      create: { telegramId }
    });

    await this.prisma.friendship.upsert({
      where: {
        requesterId_addresseeId: {
          requesterId: userId,
          addresseeId: friend.id
        }
      },
      update: { status: FriendshipStatus.ACCEPTED },
      create: {
        requesterId: userId,
        addresseeId: friend.id,
        status: FriendshipStatus.ACCEPTED
      }
    });

    return friend;
  }
}

