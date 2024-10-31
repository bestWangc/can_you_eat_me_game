import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prismaInstance";

const prismaClient = prisma as unknown as Record<string, any>;

export const updateTimeMiddleware = (
  tableName: string,
  getWhereClause: (req: Request) => any
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentTime = Math.floor(Date.now() / 1000);

      const whereClause = getWhereClause(req);
      await prismaClient[tableName].update({
        where: whereClause,
        data: {
          update_time: currentTime,
        },
      });

      next();
    } catch (error) {
      res.status(500).json({ error: "Failed to update time" });
    }
  };
};
