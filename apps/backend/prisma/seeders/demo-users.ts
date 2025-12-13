import { PrismaClient, FriendshipStatus, GroupRole } from "@prisma/client";

export async function seedDemoUsers(prisma: PrismaClient) {
  const alice = await prisma.user.upsert({
    where: { telegramId: "1001" },
    update: {},
    create: {
      telegramId: "1001",
      username: "alice",
      firstName: "Alice",
      lastName: "Wonder",
    },
  });

  const bob = await prisma.user.upsert({
    where: { telegramId: "1002" },
    update: {},
    create: {
      telegramId: "1002",
      username: "bob",
      firstName: "Bob",
      lastName: "Builder",
    },
  });

  await prisma.friendship.upsert({
    where: {
      requesterId_addresseeId: {
        requesterId: alice.id,
        addresseeId: bob.id,
      },
    },
    update: { status: FriendshipStatus.ACCEPTED },
    create: {
      requesterId: alice.id,
      addresseeId: bob.id,
      status: FriendshipStatus.ACCEPTED,
    },
  });

  const group = await prisma.group.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Demo Trip",
      settlementCurrency: "USD",
      createdById: alice.id,
    },
  });

  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: alice.id } },
    update: { role: GroupRole.ADMIN },
    create: { groupId: group.id, userId: alice.id, role: GroupRole.ADMIN },
  });

  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: bob.id } },
    update: {},
    create: { groupId: group.id, userId: bob.id, role: GroupRole.MEMBER },
  });

  console.log("Demo users seeded: alice, bob");
}

