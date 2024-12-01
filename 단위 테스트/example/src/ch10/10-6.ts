import { PrismaClient } from "@prisma/client";

export const clearDatabase = async () => {
  const prisma = new PrismaClient();

  try {
    await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0;`;

    const tables = Object.keys(prisma).filter(
      (key) =>
        typeof prisma[key] === "object" &&
        prisma[key] !== null &&
        "deleteMany" in prisma[key]
    );

    await Promise.all(tables.map((table) => prisma[table].deleteMany()));

    await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1;`;
  } catch (error) {
    console.error("Error clearing database:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

describe("UserController", () => {
  beforeEach(async () => {
    await clearDatabase();
  });
});
