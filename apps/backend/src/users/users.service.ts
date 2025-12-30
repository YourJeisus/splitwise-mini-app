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

  async getAdminGrantBanner(userId: string) {
    const now = new Date();
    
    // Найти все активные группы пользователя с Trip Pass от админа
    const groupMember = await this.prisma.groupMember.findFirst({
      where: {
        userId,
        isActive: true,
        group: {
          entitlements: {
            some: {
              productCode: 'TRIP_PASS_30D',
              endsAt: { gt: now },
              showAdminGrantBanner: true,
              adminGrantBannerShown: false,
            }
          }
        }
      },
      include: {
        group: {
          include: {
            entitlements: {
              where: {
                productCode: 'TRIP_PASS_30D',
                endsAt: { gt: now },
                showAdminGrantBanner: true,
                adminGrantBannerShown: false,
              }
            }
          }
        }
      }
    });

    if (!groupMember || !groupMember.group.entitlements[0]) {
      return null;
    }

    const entitlement = groupMember.group.entitlements[0];
    const durationDays = Math.ceil((entitlement.endsAt.getTime() - entitlement.startsAt.getTime()) / (1000 * 60 * 60 * 24));

    return {
      entitlementId: entitlement.id,
      durationDays,
    };
  }

  async dismissAdminGrantBanner(userId: string) {
    const now = new Date();
    
    // Найти entitlement для закрытия баннера
    const groupMember = await this.prisma.groupMember.findFirst({
      where: {
        userId,
        isActive: true,
        group: {
          entitlements: {
            some: {
              productCode: 'TRIP_PASS_30D',
              endsAt: { gt: now },
              showAdminGrantBanner: true,
              adminGrantBannerShown: false,
            }
          }
        }
      },
      include: {
        group: {
          include: {
            entitlements: {
              where: {
                productCode: 'TRIP_PASS_30D',
                endsAt: { gt: now },
                showAdminGrantBanner: true,
                adminGrantBannerShown: false,
              }
            }
          }
        }
      }
    });

    if (groupMember && groupMember.group.entitlements[0]) {
      await this.prisma.entitlement.update({
        where: { id: groupMember.group.entitlements[0].id },
        data: { adminGrantBannerShown: true }
      });
    }

    return { success: true };
  }
}

