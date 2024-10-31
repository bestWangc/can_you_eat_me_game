import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient, users } from "@prisma/client";
import { successRes, errorRes } from "../utils/responseHandler";
import { logAction } from "../utils/logger";
import { usersToken } from "../models/models";
import { cacheMiddleware } from "../middlewares/cacheMiddleware";
import { updateTimeMiddleware } from "../middlewares/updateTime";
import { createSelectFields } from "../utils/tools";
import { prisma } from "../utils/prismaInstance";
import { handlerBuyToken } from "../utils/listeningCont";
import _ from "lodash";
import cron from "node-cron";

// 0点执行
let isRunning = false;
cron.schedule("*/5 * * * *", async () => {
  if (isRunning) return; // 如果任务正在运行，直接返回
  isRunning = true;
  console.log("开始处理链上充值");
  try {
    console.time("Execution Time");
    await handlerBuyToken();
    console.timeEnd("Execution Time");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    isRunning = false;
    // 关闭数据库连接或其他清理操作
    await prisma.$disconnect(); // 如果使用 Prisma
  }
});

export const getUserInfo = [
  // updateTimeMiddleware("users", (req) => ({ id: req.user?.uid })),
  async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;

      if (!uid) {
        return errorRes(res, "user id not allow empty or invalid");
      }

      const fields = [
        "id",
        "level_id",
        "gold_amount",
        "diamond_amount",
        "last_sign_time",
        "sign_day",
        "last_get_free_gold_time",
        "last_getfree_diamond_time",
        "invite_code",
        "invite_rewards",
      ];

      const selectField = createSelectFields(fields);
      const user = (await prisma.users.findUnique({
        select: selectField,
        where: { id: uid, status: 1 },
      })) as users | null;

      if (!user) {
        return errorRes(res, "User not found");
      }
      //查询当前用户邀请的人数
      const userReferCount = await prisma.users.count({
        where: {
          referred_by: uid
        },
      });

      const userResponse = {
        ...user,
        gold_amount: user.gold_amount?.toString(),
        diamond_amount: user.diamond_amount?.toString(),
        buy_usdt: user.buy_usdt?.toString(),
        invite_number:userReferCount ?? 0
      };

      successRes(res, userResponse);
    } catch (error) {
      errorRes(res, "network error!");
    }
  },
];

function generateToken(userPayload: any): string {
  const JWT_SECRET: string = process.env.JWT_SECRET_KEY as string;
  return jwt.sign(userPayload, JWT_SECRET, { expiresIn: 1800 });
}


export const useInviteCode = [
  async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;

      if (!uid) {
        return errorRes(res, "user id not allow empty or invalid");
      }

      const { invite_code } = req.body;
      if (_.isEmpty(invite_code)) {
        return errorRes(res, "invite code not allow empty");
      }

      //查询当前用户信息
      const user = await prisma.users.findUnique({
        select: { id: true, referred_by: true },
        where: { id: uid },
      });

      if (!user) {
        return errorRes(res, "user not found");
      }
      if (user.referred_by) {
        return errorRes(res, "user invite code has bind");
      }
      //查询invite code 是否存在
      const referUser = await prisma.users.findFirst({
        select: { id: true },
        where: {
          id: { not: uid }, // id 不等于 1
          invite_code: invite_code,
        }
      });
      if (_.isEmpty(referUser)) {
        return errorRes(res, "invite code not found");
      }

      const currentTime = Math.floor(Date.now() / 1000);
      await prisma.users.update({
        where: { id: uid },
        data: {
          referred_by: referUser.id,
          update_time: currentTime
        },
      });
      await logAction("bind_invite_code", `uid:${uid},invite_code:${invite_code}`);

      return successRes(res, {});
    } catch (error) {
      errorRes(res, (error as Error).message);
    }
  },
];

export const getReferrals = [
  // cacheMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { telegram_id } = req.params;

      const bigTelegram_id = BigInt(telegram_id);

      const user = await prisma.users.findUnique({
        where: { telegram_id: bigTelegram_id },
      });

      if (!user) {
        return errorRes(res, "User not found");
      }

      const referrals = await prisma.users.findMany({
        where: { referred_by: user.id },
      });

      successRes(res, referrals);
    } catch (error) {
      errorRes(res, (error as Error).message);
    }
  },
];

export const getAllUsers = [
  // cacheMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { address } = req.query;
      const users = await prisma.users.findMany({
        where: address ? { address: { contains: address as string } } : {},
      });

      const serializedUsers = users.map((user) => ({
        ...user,
        telegram_id: user.telegram_id.toString(),
        gold_amount: user.gold_amount.toString(),
        diamond_amount: user.diamond_amount.toString(),
        buy_usdt: user.buy_usdt.toString(),
      }));

      successRes(res, serializedUsers);
    } catch (error) {
      errorRes(res, (error as Error).message);
    }
  },
];

//获取用户jwt token
export const getUserToken = [
  async (req: Request, res: Response) => {
    try {
      const { telegram_id } = req.body;

      // 验证输入
      if (!telegram_id || isNaN(Number(telegram_id))) {
        return errorRes(res, "Invalid telegram id");
      }

      const bigTelegram_id = BigInt(telegram_id);

      // 查询用户
      let user = await prisma.users.findUnique({
        select: { id: true, telegram_id: true },
        where: { telegram_id: bigTelegram_id, status: 1 },
      });
      if (_.isEmpty(user)) {
        //未找到用户  新创建一个
        user = await prisma.users.create({
          data: {
            telegram_id,
            invite_code: "",
            create_time: Math.floor(Date.now() / 1000),
          },
        });
        await logAction("create_user", `tgId:${telegram_id}`);
      }
      // 生成 JWT
      const userKey = {
        uid: user.id,
        telegram_id: user.telegram_id.toString(),
      };

      const token = generateToken(userKey);
      successRes(res, { token });
    } catch (error) {
      errorRes(res, (error as Error).message);
    }
  },
];

//刷新jwt token
export const refreshUserToken = [
  async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return errorRes(res, "Refresh token is required");
      }

      let finalToken = refreshToken;
      const now = Math.floor(Date.now() / 1000);
      // 检查剩余时间
      const currentUserData = req.user;
      if (!currentUserData) {
        return errorRes(res, "error");
      }
      const remainingTime = currentUserData.exp - now;
      if (remainingTime <= 300) {
        //剩余5分钟时认为快要过期
        // 生成新的JWT
        const userKey = {
          uid: currentUserData.uid,
          telegram_id: currentUserData.telegram_id,
          address: currentUserData.address,
        };
        finalToken = generateToken(userKey);
      }
      return successRes(res, { token: finalToken });
    } catch (error) {
      errorRes(res, (error as Error).message);
    }
  },
];
