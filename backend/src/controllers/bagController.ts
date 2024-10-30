import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { successRes, errorRes } from "../utils/responseHandler";
import { logAction } from "../utils/logger";
import { cacheMiddleware } from "../middlewares/cacheMiddleware";
import { updateTimeMiddleware } from "../middlewares/updateTime";
import { createSelectFields } from "../utils/tools";
import { prisma } from "../utils/prismaInstance";
import Redis from "ioredis";
import _ from "lodash";

export const getBag = [
  async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return errorRes(res, "user id not allow empty or invalid");
      }

      const cacheKey = uid + "-fruit-bags";
      const redis = new Redis();
      const data = await redis.get(cacheKey);
      if (data) {
        return successRes(res, JSON.parse(data));
      }

      const user = await prisma.users.findUnique({
        select: { id: true },
        where: { id: uid, status: 1 },
      });
      if (!user) {
        return errorRes(res, "User not found");
      }
      const userID = user.id;
      const fields = [
        "id",
        "fruit_id",
        "quality",
        "fragments",
        "fruit_level",
        "attack",
        "atk_speed",
        "baojilv",
        "baoji",
      ];
      const selectField = createSelectFields(fields);

      let bag = await prisma.user_bag.findMany({
        select: selectField,
        where: { uid: userID, fruit_number: 1 },
      });

      if (_.isEmpty(bag)) {
        //如果不存在  给user 初始化bag
        const fruits = await prisma.fruit.findMany({
          where: { status: 1 },
        });
        const initialFruits = fruits.map((fruit) => ({
          uid: user.id,
          fruit_id: fruit.fruit_id,
          quality: fruit.quality,
          attack: fruit.attack,
          atk_speed: fruit.attack_speed,
          baojilv: fruit.baojilv,
          baoji: fruit.baoji,
          fruit_number: fruit.unlock === 0 ? 1 : 0,
          create_time: Math.floor(Date.now() / 1000),
        }));
        await prisma.user_bag.createMany({
          data: initialFruits,
        });
        await logAction("init_user_bag", `uid:${uid}`);

        bag = await prisma.user_bag.findMany({
          select: selectField,
          where: { uid: userID, fruit_number: 1 },
        });
      }
      let bagInfo = {};
      if (!_.isEmpty(bag)) {
        bagInfo = bag.reduce((acc, item) => {
          acc[item.fruit_id] = item; // 将整个对象作为值
          return acc;
        }, {} as { [key: number]: any });
        redis.setex(cacheKey, 3600, JSON.stringify(bagInfo));
      }
      return successRes(res, bagInfo);
    } catch (error) {
      return errorRes(res, (error as Error).message);
    }
  },
];

export const getFruitDetails = [
  // cacheMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { fruitId } = req.body;

      const uid = req.user?.uid;
      if (!uid) {
        return errorRes(res, "User need to login");
      }

      const user = await prisma.users.findUnique({
        select: { id: true },
        where: { id:uid },
      });

      const fruit = await prisma.fruit.findUnique({
        where: { fruit_id: Number(fruitId) },
      });

      if (!fruit || !user) {
        return errorRes(res, "Fruit and User not found");
      }

      const user_Levels = await prisma.user_bag.findUnique({
        where: {
          uid_fruit_id: {
            uid: uid,
            fruit_id: fruit.fruit_id,
          },
        },
      });

      const fruit_level = await prisma.fruit_level_up.findMany({
        where: { fruit_id: Number(fruitId) },
      });

      successRes(res, { fruit, user_Levels, fruit_level });
    } catch (error) {
      errorRes(res, (error as Error).message);
    }
  },
];

export const upgradeFruit = [
  // updateTimeMiddleware("user_bag", (req) => ({ uid: req.user?.uid })),
  async (req: Request, res: Response) => {
    try {
      const { fruitId } = req.body;
      const uid = req.user?.uid;
      if (!uid) {
        return errorRes(res, "User need to login");
      }
      if (!fruitId || fruitId < 0) {
        return errorRes(res, "fruit need");
      }

      const user = await prisma.users.findUnique({
        where: { id: uid, status: 1 },
      });
      if (!user) {
        return errorRes(res, "User not found");
      }
      let fields = [
        "fruit_id",
        "fruit_level",
        "fragments",
        "atk_speed",
        "attack",
      ];
      let selectField = createSelectFields(fields);
      const user_fruit = await prisma.user_bag.findUnique({
        // select: selectField,
        where: {
          uid_fruit_id: {
            uid: user.id,
            fruit_id: Number(fruitId),
          },
        },
      });
      if (!user_fruit) {
        return errorRes(res, "User or fruit not found");
      }

      const oldLv = user_fruit.fruit_level;

      fields = [
        "fruit_id",
        "up_cost_gold",
        "up_cost_piece",
        "add_attack",
        "add_atk_speed",
      ];

      selectField = createSelectFields(fields);
      const fruitGain = await prisma.fruit_level_up.findFirst({
        select: selectField,
        where: {
          fruit_id: fruitId,
          level: oldLv,
        },
      });

      const fruitTalent = await prisma.talent.findFirst({
        // select: selectField,
        where: {
          fruit_id: fruitId,
          unlock: oldLv + 1,
        },
      });

      if (!fruitGain) {
        return errorRes(res, "Unable to obtain upgrade information");
      }

      const up_cost_gold = fruitGain.up_cost_gold;
      const up_cost_piece = fruitGain.up_cost_piece;
      if (
        user.gold_amount < up_cost_gold ||
        user_fruit.fragments < up_cost_piece
      ) {
        return errorRes(res, "Not enough resources");
      }

      const currentTime = Math.floor(Date.now() / 1000);
      //计算要增加的攻击力 和攻速
      const oldAtk = user_fruit.attack;
      const oldAtkSpeed = user_fruit.atk_speed;
      let addAtk: number = fruitGain.add_attack;
      let addAtkSpeed: number = fruitGain.add_atk_speed;
      if (oldAtk == 0 || oldAtkSpeed == 0) {
        fields = ["attack", "attack_speed"];
        selectField = createSelectFields(fields);
        const fruits = await prisma.fruit.findFirst({
          select: selectField,
          where: {
            fruit_id: Number(fruitId),
          },
        });
        if (!_.isEmpty(fruits)) {
          if (oldAtk == 0) {
            addAtk += fruits?.attack;
          }
          if (oldAtkSpeed == 0) {
            addAtkSpeed += fruits?.attack_speed;
          }
        }
      }

      await prisma.$transaction(async (prisma) => {
        await prisma.users.update({
          where: { id: uid },
          data: {
            gold_amount: {
              decrement: BigInt(up_cost_gold),
            },
            update_time: currentTime,
          },
        });

        await prisma.user_bag.update({
          where: {
            uid_fruit_id: {
              uid: user.id,
              fruit_id: Number(fruitId),
            },
          },
          data: {
            fragments: {
              decrement: up_cost_piece,
            },
            fruit_level: {
              increment: 1,
            },
            attack: {
              set: Math.round(
                (user_fruit.attack + addAtk) * (fruitTalent?.type == 1 ? Number(fruitTalent.value) / 100 + 1 : 1)
              ),
            },
            atk_speed: {
              set: Math.round(
                (user_fruit.atk_speed + addAtkSpeed) * (fruitTalent?.type == 2 ? Number(fruitTalent.value) / 100 + 1 : 1)
              ),
            },
            baoji: {
              increment: fruitTalent?.type == 4 ? Number(fruitTalent.value) : 0,
            },
            baojilv: {
              increment: fruitTalent?.type == 3 ? Number(fruitTalent.value) : 0,
            },
            fruit_number: 1,
            update_time: currentTime,
          },
        });

        await logAction(
          "upgrade_fruit",
          `uid:${uid},furitId:${fruitId},up_cost_gold:${up_cost_gold},up_cost_piece:${up_cost_piece},oldLv:${oldLv},addAtk:${addAtk},addAtkSpeed:${addAtkSpeed}`
        );
      });

      const cacheKey = uid + "-fruit-bags";
      const redis = new Redis();
      await redis.setex(cacheKey, 1, "");

      successRes(res, {
        currentLevel: oldLv + 1,
        costPiece: up_cost_piece,
        costGold: up_cost_gold,
        addAtk: addAtk,
        addAtkSpeed: addAtkSpeed,
        talentDesc: fruitTalent?.desc,
        talentValue: fruitTalent?.value,
      });
    } catch (error) {
      errorRes(res, (error as Error).message);
    }
  },
];
