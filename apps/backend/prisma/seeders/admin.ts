import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

export async function seedAdmin(prisma: PrismaClient) {
  const adminPassword = await bcrypt.hash("admin123", 10);
  await prisma.adminUser.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      passwordHash: adminPassword,
      role: "OWNER",
      enabled: true,
    },
  });
  console.log("Admin user seeded: admin@example.com / admin123");
}

