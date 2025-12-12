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
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo Trip',
      settlementCurrency: 'USD',
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

  await prisma.product.upsert({
    where: { code: 'TRIP_PASS_21D' },
    update: {
      title: 'Trip Pass (21 день)',
      starsPrice: 399,
      durationDays: 21,
      active: true,
      priceBySettlementCurrency: { RUB: 399.0, USD: 4.99 }
    },
    create: {
      code: 'TRIP_PASS_21D',
      title: 'Trip Pass (21 день)',
      starsPrice: 399,
      durationDays: 21,
      active: true,
      priceBySettlementCurrency: { RUB: 399.0, USD: 4.99 }
    }
  });

  // === Группа 345 с моковыми данными для демонстрации итогов ===
  await seedGroup345();

  console.log('Seed complete');
}

async function seedGroup345() {
  // Создаём dev-пользователей если их нет
  const devAlex = await prisma.user.upsert({
    where: { telegramId: 'dev_111' },
    update: {},
    create: {
      telegramId: 'dev_111',
      username: 'alex_dev',
      firstName: 'Алекс',
    }
  });

  const devMaria = await prisma.user.upsert({
    where: { telegramId: 'dev_222' },
    update: {},
    create: {
      telegramId: 'dev_222',
      username: 'maria_dev',
      firstName: 'Мария',
    }
  });

  const devIvan = await prisma.user.upsert({
    where: { telegramId: 'dev_333' },
    update: {},
    create: {
      telegramId: 'dev_333',
      username: 'ivan_dev',
      firstName: 'Иван',
    }
  });

  // Группа 345 - Поездка в Грузию
  // Не задаём fixedFxRates — курс подтянется автоматически через API при первом запросе
  const group345 = await prisma.group.upsert({
    where: { id: '00000000-0000-0000-0000-000000000345' },
    update: {
      homeCurrency: 'RUB',
    },
    create: {
      id: '00000000-0000-0000-0000-000000000345',
      name: 'Грузия 🇬🇪',
      settlementCurrency: 'GEL',
      homeCurrency: 'RUB',
      createdById: devAlex.id,
    }
  });

  // Добавляем участников
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group345.id, userId: devAlex.id } },
    update: { role: GroupRole.ADMIN },
    create: { groupId: group345.id, userId: devAlex.id, role: GroupRole.ADMIN }
  });

  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group345.id, userId: devMaria.id } },
    update: {},
    create: { groupId: group345.id, userId: devMaria.id, role: GroupRole.MEMBER }
  });

  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group345.id, userId: devIvan.id } },
    update: {},
    create: { groupId: group345.id, userId: devIvan.id, role: GroupRole.MEMBER }
  });

  // Активируем Trip Pass для группы
  const now = new Date();
  const endsAt = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);

  // Сначала создаём покупку
  await prisma.purchase.upsert({
    where: { id: '00000000-0000-0000-0000-000000000999' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000999',
      productCode: 'TRIP_PASS_21D',
      groupId: group345.id,
      buyerUserId: devAlex.id,
      invoicePayload: 'seed_tp_345',
      starsAmount: 399,
      currency: 'XTR',
      status: 'PAID',
      splitCost: false,
      settlementFeeAmount: 10,
      settlementCurrency: 'GEL',
      paidAt: now,
    }
  });

  // Затем создаём entitlement
  await prisma.entitlement.upsert({
    where: { purchaseId: '00000000-0000-0000-0000-000000000999' },
    update: { endsAt },
    create: {
      id: '00000000-0000-0000-0000-000000000998',
      groupId: group345.id,
      productCode: 'TRIP_PASS_21D',
      startsAt: now,
      endsAt,
      purchaseId: '00000000-0000-0000-0000-000000000999',
    }
  });

  // Удаляем старые траты группы 345 для чистоты
  await prisma.expenseShare.deleteMany({
    where: { expense: { groupId: group345.id } }
  });
  await prisma.expense.deleteMany({
    where: { groupId: group345.id, isSystem: false }
  });

  // Создаём траты по дням (7 дней поездки)
  const expenses = [
    // День 1 - 5 декабря (прилёт)
    { date: '2024-12-05', desc: 'Такси из аэропорта', amount: 45, payer: devAlex, category: 'transport' },
    { date: '2024-12-05', desc: 'Ужин в ресторане', amount: 120, payer: devMaria, category: 'food' },
    { date: '2024-12-05', desc: 'Вино в магазине', amount: 35, payer: devIvan, category: 'food' },
    
    // День 2 - 6 декабря (экскурсия)
    { date: '2024-12-06', desc: 'Экскурсия в Мцхету', amount: 180, payer: devAlex, category: 'activities' },
    { date: '2024-12-06', desc: 'Обед в Мцхете', amount: 85, payer: devMaria, category: 'food' },
    { date: '2024-12-06', desc: 'Сувениры', amount: 60, payer: devIvan, category: 'shopping' },
    
    // День 3 - 7 декабря (самый дорогой день)
    { date: '2024-12-07', desc: 'Аренда машины', amount: 250, payer: devAlex, category: 'transport' },
    { date: '2024-12-07', desc: 'Бензин', amount: 80, payer: devAlex, category: 'transport' },
    { date: '2024-12-07', desc: 'Обед в Казбеги', amount: 95, payer: devMaria, category: 'food' },
    { date: '2024-12-07', desc: 'Канатка на Гудаури', amount: 90, payer: devIvan, category: 'activities' },
    { date: '2024-12-07', desc: 'Ужин с хинкали', amount: 110, payer: devMaria, category: 'food' },
    
    // День 4 - 8 декабря
    { date: '2024-12-08', desc: 'Завтрак в отеле', amount: 45, payer: devIvan, category: 'food' },
    { date: '2024-12-08', desc: 'Дегустация вина', amount: 150, payer: devAlex, category: 'activities' },
    { date: '2024-12-08', desc: 'Покупка вина домой', amount: 200, payer: devMaria, category: 'shopping' },
    
    // День 5 - 9 декабря
    { date: '2024-12-09', desc: 'Серные бани', amount: 75, payer: devIvan, category: 'activities' },
    { date: '2024-12-09', desc: 'Массаж', amount: 120, payer: devMaria, category: 'activities' },
    { date: '2024-12-09', desc: 'Ужин на крыше', amount: 180, payer: devAlex, category: 'food' },
    
    // День 6 - 10 декабря
    { date: '2024-12-10', desc: 'Рынок Дезертирка', amount: 95, payer: devMaria, category: 'shopping' },
    { date: '2024-12-10', desc: 'Уличная еда', amount: 40, payer: devIvan, category: 'food' },
    { date: '2024-12-10', desc: 'Кофейня', amount: 25, payer: devAlex, category: 'food' },
    
    // День 7 - 11 декабря (вылет)
    { date: '2024-12-11', desc: 'Такси в аэропорт', amount: 50, payer: devAlex, category: 'transport' },
    { date: '2024-12-11', desc: 'Еда в аэропорту', amount: 55, payer: devMaria, category: 'food' },
  ];

  const allUsers = [devAlex, devMaria, devIvan];

  for (const exp of expenses) {
    const expense = await prisma.expense.create({
      data: {
        groupId: group345.id,
        createdById: exp.payer.id,
        description: exp.desc,
        settlementAmount: exp.amount,
        settlementCurrency: 'GEL',
        originalAmount: exp.amount,
        originalCurrency: 'GEL',
        fxRate: 1,
        fxSource: 'SETTLEMENT',
        category: exp.category,
        createdAt: new Date(exp.date + 'T12:00:00Z'),
      }
    });

    // Делим поровну между всеми участниками
    const perPerson = exp.amount / 3;
    for (const user of allUsers) {
      await prisma.expenseShare.create({
        data: {
          expenseId: expense.id,
          userId: user.id,
          paid: user.id === exp.payer.id ? exp.amount : 0,
          owed: perPerson,
        }
      });
    }
  }

  // Добавляем один settlement (Иван вернул Алексу часть)
  await prisma.settlement.create({
    data: {
      fromUserId: devIvan.id,
      toUserId: devAlex.id,
      groupId: group345.id,
      amount: 200,
      currency: 'GEL',
      note: 'Часть долга',
      createdAt: new Date('2024-12-10T18:00:00Z'),
    }
  });

  console.log('Group 345 seeded with mock data');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

