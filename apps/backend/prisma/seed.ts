import { PrismaClient } from "@prisma/client";
import {
  seedAdmin,
  seedDemoUsers,
  seedProducts,
  seedGroup345,
} from "./seeders";

const prisma = new PrismaClient();

async function main() {
  await seedAdmin(prisma);
  await seedDemoUsers(prisma);
  await seedProducts(prisma);
  await seedGroup345(prisma);
  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
