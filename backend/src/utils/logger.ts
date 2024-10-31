import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const logAction = async (action: string, details: string) => {
  await prisma.logs.create({
    data: {
      action,
      memo: details,
      create_time: Math.floor(Date.now() / 1000),
    },
  });
};
