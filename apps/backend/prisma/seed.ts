import { PrismaClient, FriendshipStatus, GroupRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const alice = await prisma.user.upsert({
    where: { telegramId: '1001' },
    update: {},
    create: {
      telegramId: '1001',
      username: 'alice',
      firstName: 'Alice',
      lastName: 'Wonder'
    }
  });

  const bob = await prisma.user.upsert({
    where: { telegramId: '1002' },
    update: {},
    create: {
      telegramId: '1002',
      username: 'bob',
      firstName: 'Bob',
      lastName: 'Builder'
    }
  });

  await prisma.friendship.upsert({
    where: {
      requesterId_addresseeId: {
        requesterId: alice.id,
        addresseeId: bob.id
      }
    },
    update: { status: FriendshipStatus.ACCEPTED },
    create: {
      requesterId: alice.id,
      addresseeId: bob.id,
      status: FriendshipStatus.ACCEPTED
    }
  });

  const group = await prisma.group.upsert({
    where: { id: 'demo-group' },
    update: {},
    create: {
      id: 'demo-group',
      name: 'Demo Trip',
      currency: 'USD',
      createdById: alice.id
    }
  });

  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: alice.id } },
    update: { role: GroupRole.ADMIN },
    create: { groupId: group.id, userId: alice.id, role: GroupRole.ADMIN }
  });

  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: bob.id } },
    update: {},
    create: { groupId: group.id, userId: bob.id, role: GroupRole.MEMBER }
  });

  console.log('Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

