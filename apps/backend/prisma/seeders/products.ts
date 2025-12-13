import { PrismaClient } from "@prisma/client";

export async function seedProducts(prisma: PrismaClient) {
  await prisma.product.upsert({
    where: { code: "TRIP_PASS_21D" },
    update: {
      title: "Trip Pass (21 день)",
      starsPrice: 1,
      durationDays: 21,
      active: true,
      priceBySettlementCurrency: { RUB: 1.0, USD: 0.01, GEL: 0.01 },
    },
    create: {
      code: "TRIP_PASS_21D",
      title: "Trip Pass (21 день)",
      starsPrice: 1,
      durationDays: 21,
      active: true,
      priceBySettlementCurrency: { RUB: 1.0, USD: 0.01, GEL: 0.01 },
    },
  });
  console.log("Products seeded: TRIP_PASS_21D");
}

