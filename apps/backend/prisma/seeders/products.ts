import { PrismaClient } from "@prisma/client";

export async function seedProducts(prisma: PrismaClient) {
  // Создаём новый продукт TRIP_PASS_30D
  await prisma.product.upsert({
    where: { code: "TRIP_PASS_30D" },
    update: {
      title: "Trip Pass (30 дней)",
      starsPrice: 200, // Зачёркнутая цена
      durationDays: 30,
      active: true,
      priceBySettlementCurrency: { RUB: 200.0, USD: 2.0, GEL: 5.0 },
    },
    create: {
      code: "TRIP_PASS_30D",
      title: "Trip Pass (30 дней)",
      starsPrice: 200, // Зачёркнутая цена
      durationDays: 30,
      active: true,
      priceBySettlementCurrency: { RUB: 200.0, USD: 2.0, GEL: 5.0 },
    },
  });

  // Создаём скидку — реальная цена 100 звёзд
  await prisma.productPricing.upsert({
    where: { productCode: "TRIP_PASS_30D" },
    update: {
      globalDiscountType: "FIXED_OVERRIDE",
      starsPriceOverride: 100,
      enabled: true,
    },
    create: {
      productCode: "TRIP_PASS_30D",
      globalDiscountType: "FIXED_OVERRIDE",
      starsPriceOverride: 100,
      enabled: true,
    },
  });

  // Деактивируем старый продукт если есть
  await prisma.product
    .update({
      where: { code: "TRIP_PASS_21D" },
      data: { active: false },
    })
    .catch(() => {});

  console.log("Products seeded: TRIP_PASS_30D (200⭐ -> 100⭐)");
}

