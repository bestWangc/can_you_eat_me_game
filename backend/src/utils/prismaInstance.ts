import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"], // 启用查询日志
});
