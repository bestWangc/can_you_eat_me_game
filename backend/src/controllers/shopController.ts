import { Request, Response } from "express";
import { PrismaClient, fruit } from "@prisma/client";
import { successRes, errorRes } from "../utils/responseHandler";
import { logAction } from "../utils/logger";
import { cacheMiddleware } from "../middlewares/cacheMiddleware";
import { Fruit } from "../models/models";
import Redis from "ioredis";
import { convertBigIntToJSON } from "../utils/tools";
import _ from "lodash";
import moment from "moment";
import { prisma } from "../utils/prismaInstance";
import { generateDailyShops } from "../utils/getShop";
import cron from "node-cron";

generateDailyShops();

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export const getDiscountShops = [
  async (req: Request, res: Response) => {
    try {
      const startTimestap = moment().startOf("day").unix();
      const endTimestap = moment().endOf("day").unix();

      const cacheKey = `${startTimestap}-${endTimestap}-discountShops`;
      const redis = new Redis();
      const data = await redis.get(cacheKey);
      if (data) {
        return successRes(res, JSON.parse(data));
      }

      const result = await prisma.$queryRaw`
          SELECT sp.id,sp.fragments,sp.diamonds,sp.fruit_id,f.name,f.little_desc,f.quality
          FROM shop sp
          LEFT JOIN fruit f ON f.fruit_id = sp.fruit_id
          WHERE f.status = 1
          and sp.create_time >= ${startTimestap} and sp.create_time <= ${endTimestap}
      `;
      let dataRes = {};
      //缓存6小时
      if (!_.isEmpty(result)) {
        dataRes = convertBigIntToJSON(result);
        await redis.setex(cacheKey, 3600, JSON.stringify(dataRes));
      }

      return successRes(res, dataRes);
    } catch (error) {
      return errorRes(res, (error as Error).message);
    }
  },
];

export const buyFruitFragment = [
  async (req: Request, res: Response) => {
    try {
      const { shopId } = req.body;

      const uid = req.user?.uid;
      if (!uid) {
        return errorRes(res, "please reload game");
      }
      const tgID = BigInt(parseInt(req.user?.telegram_id ?? ""));
      // 判断所有入参
      if (!shopId) {
        return errorRes(res, "shopId are required");
      }

      const redis = new Redis();
      const today = moment().format("YYYY-MM-DD");
      const purchaseKey = `purchaseCount:${uid}:${today}`;
      const purchaseCount = await redis.get(purchaseKey);

      if (purchaseCount && parseInt(purchaseCount) >= 126) {
        return errorRes(res, "Exceeding the maximum purchase limit");
      }

      const user = await prisma.users.findUnique({
        select: { id: true, diamond_amount: true },
        where: { id: uid, telegram_id: tgID, status: 1 },
      });
      if (_.isEmpty(user)) {
        return errorRes(res, "User not found");
      }
      const shops = await prisma.shop.findUnique({
        where: { id: shopId },
      });
      if (_.isEmpty(shops)) {
        return errorRes(res, "shop not found");
      }

      if (user.diamond_amount < shops.diamonds) {
        return errorRes(res, "Not enough diamonds");
      }

      const addFragmentAmount = shops.fragments;
      const fruitID = shops.fruit_id;
      const costDiamonds = shops.diamonds;

      //查询时候已经存在该碎片
      let userBagInfo = await prisma.user_bag.findFirst({
        select: { id: true, fragments: true },
        where: {
          uid: uid,
          fruit_id: shops.fruit_id,
        },
      });
      let needUpdate = true;
      let updateBagID = userBagInfo?.id ?? 0;
      let currentFragments = userBagInfo?.fragments ?? 0;

      if (_.isEmpty(userBagInfo)) {
        needUpdate = false;
      }

      //开始事务
      await prisma.$transaction(async (prisma) => {
        //扣除用户钻石
        await prisma.users.update({
          where: { id: uid },
          data: {
            diamond_amount: {
              decrement: costDiamonds,
            },
          },
        });

        //增加或者更新 user bag
        if (needUpdate) {
          await prisma.user_bag.update({
            where: {
              id: updateBagID,
            },
            data: {
              fragments: {
                increment: addFragmentAmount,
              },
              fruit_number: 1,
            },
          });
          currentFragments += addFragmentAmount;
        } else {
          await prisma.user_bag.create({
            data: {
              uid: uid,
              fruit_id: fruitID,
              fruit_number: 1,
              create_time: Math.floor(Date.now() / 1000),
              fragments: addFragmentAmount,
            },
          });
          currentFragments = addFragmentAmount;
        }

        await logAction(
          "buy_fruit_fragment",
          `uid:${uid},tgId:${tgID},shopId:${shopId},fragments:${shops.fragments},fruitId:${fruitID}`
        );
      });

      await redis.incr(purchaseKey);
      await redis.expire(purchaseKey, 24 * 60 * 60);

      //清除缓存
      const cacheKey = uid + "-fruit-bags";
      await redis.setex(cacheKey, 1, "");

      successRes(res, {
        fruitID: fruitID,
        costDiamonds: costDiamonds.toString(),
        costGlods: 0,
        currentFragment: currentFragments,
        addFragment: addFragmentAmount,
      });
    } catch (error) {
      errorRes(res, (error as Error).message);
    }
  },
];

export const openBoxCore = (boxKey: string) => {
  function getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function distributeFragments(total: number, counts: number[]): number[] {
    const fragments = Array(counts.length).fill(0);
    for (let i = 0; i < total; i++) {
      const index = getRandomInt(0, counts.length - 1);
      fragments[index]++;
    }
    return fragments;
  }

  function ensureMinimumFragments(
    fragments: number[],
    minimums: number[]
  ): number[] {
    return fragments.map((frag, index) => Math.max(frag, minimums[index]));
  }

  let fragmentsDistribution = [];
  let goldReward = 0;
  let fragmentReward = 0;

  if (boxKey === "boxPrice") {
    const totalFragments = 30;
    const purpleChance = Math.random() < 0.1;
    const blueCount = getRandomInt(6, 8);
    const greenCount = getRandomInt(1, 3);

    const guaranteedFragments = getRandomInt(1, 3);

    if (purpleChance) {
      fragmentsDistribution.push({
        quality: 3,
        fragments: guaranteedFragments,
      });
      const remainingFragments = totalFragments - guaranteedFragments;
      const blueFragments = distributeFragments(
        getRandomInt(6, 8),
        Array(blueCount).fill(0)
      );
      const greenFragments = distributeFragments(
        remainingFragments - blueFragments.reduce((a, b) => a + b, 0),
        Array(greenCount).fill(0)
      );

      fragmentsDistribution = [
        ...fragmentsDistribution,
        ...blueFragments.map((fragments) => ({
          quality: 2,
          fragments,
        })),
        ...greenFragments.map((fragments) => ({
          quality: 1,
          fragments,
        })),
      ];
    } else {
      const blueFragments = distributeFragments(
        getRandomInt(6, 8),
        Array(blueCount).fill(0)
      );
      const remainingFragments =
        totalFragments - blueFragments.reduce((a, b) => a + b, 0);
      const greenFragments = distributeFragments(
        remainingFragments,
        Array(greenCount).fill(0)
      );

      fragmentsDistribution = [
        ...blueFragments.map((fragments) => ({
          quality: 2,
          fragments,
        })),
        ...greenFragments.map((fragments) => ({
          quality: 1,
          fragments,
        })),
      ];
    }

    fragmentsDistribution = fragmentsDistribution.map((item) => ({
      ...item,
      fragments: ensureMinimumFragments([item.fragments], [item.quality])[0],
    }));
  } else if (boxKey === "bigBoxPrice") {
    const totalFragments = 150;
    const greenCount = getRandomInt(1, 3);
    const purpleCount = getRandomInt(1, 3);
    const blueCount = getRandomInt(6, 8);

    const guaranteedFragments = getRandomInt(1, 3);

    const greenFragments = distributeFragments(75, Array(greenCount).fill(0));
    const purpleFragments = distributeFragments(
      getRandomInt(1, 3),
      Array(purpleCount).fill(0)
    );
    const remainingFragments =
      totalFragments - 75 - purpleFragments.reduce((a, b) => a + b, 0);
    const blueFragments = distributeFragments(
      remainingFragments,
      Array(blueCount).fill(0)
    );

    fragmentsDistribution = [
      ...greenFragments.map((fragments) => ({
        quality: 1,
        fragments,
      })),
      ...purpleFragments.map((fragments) => ({
        quality: 3,
        fragments: guaranteedFragments,
      })),
      ...blueFragments.map((fragments) => ({
        quality: 2,
        fragments,
      })),
    ];

    fragmentsDistribution = fragmentsDistribution.map((item) => ({
      ...item,
      fragments: ensureMinimumFragments([item.fragments], [item.quality])[0],
    }));
  } else {
    throw new Error("Invalid box type");
  }

  return { goldReward, fragmentReward, fragmentsDistribution };
};

export const openBox = [
  async (req: Request, res: Response) => {
    try {
      const { boxType } = req.body;
      const uid = req.user?.uid;

      if (!uid) {
        return errorRes(res, "please retry");
      }
      // 判断所有入参
      if (!boxType) {
        return errorRes(res, "boxType are required");
      }

      const user = await prisma.users.findUnique({
        select: { id: true, diamond_amount: true },
        where: { id: uid, status: 1 },
      });
      if (!user) {
        return errorRes(res, "User not found");
      }

      //get price
      const boxKey = boxType == 1 ? "boxPrice" : "bigBoxPrice";
      const configs = await prisma.configs.findFirst({
        select: { value: true },
        where: { unique_key: boxKey, status: 1 },
      });
      if (!configs) {
        return errorRes(res, "config not found");
      }
      const boxPrice = BigInt(configs.value);

      if (user.diamond_amount < boxPrice) {
        return errorRes(res, "Not enough diamonds");
      }

      const { fragmentsDistribution } = openBoxCore(boxKey);

      const fruitDetails: {
        fruitId: number;
        quality: number;
        fragments: number;
      }[] = [];

      await prisma.$transaction(async (prisma) => {
        await prisma.users.update({
          where: { id: uid },
          data: { diamond_amount: user.diamond_amount - BigInt(configs.value) },
        });

        //TODO: 效率待优化，问题：循环里面查询sql
        for (const { quality, fragments } of fragmentsDistribution) {
          const fruits = await prisma.$queryRaw`
            SELECT * FROM fruit
            WHERE quality = ${quality}
            ORDER BY RAND()
            LIMIT 1
            `;

          const fruit = (fruits as fruit[])[0];

          if (fruit) {
            fruitDetails.push({
              fruitId: fruit.fruit_id,
              quality: fruit.quality,
              fragments: fragments,
            });

            const userBag = await prisma.user_bag.findUnique({
              where: {
                uid_fruit_id: {
                  uid: user.id,
                  fruit_id: fruit.fruit_id,
                },
              },
            });

            if (userBag) {
              await prisma.user_bag.update({
                where: {
                  uid_fruit_id: {
                    uid: user.id,
                    fruit_id: fruit.fruit_id,
                  },
                },
                data: {
                  fragments: {
                    increment: fragments,
                  },
                  fruit_number: 1,
                },
              });
            } else {
              await prisma.user_bag.create({
                data: {
                  uid: user.id,
                  fruit_id: fruit.fruit_id,
                  quality,
                  fragments,
                  create_time: Math.floor(Date.now() / 1000),
                },
              });
            }
          }
        }

        await logAction("open_box", `uid:${uid},box_type:${boxType}`);
      });
      if (!_.isEmpty(fruitDetails)) {
        fruitDetails.sort((a, b) => a.quality - b.quality);
      }

      //清除缓存
      const cacheKey = uid + "-fruit-bags";
      const redis = new Redis();
      await redis.setex(cacheKey, 1, "");

      successRes(res, fruitDetails);
    } catch (error) {
      errorRes(res, (error as Error).message);
    }
  },
];

export const getFreeGold = [
  async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      if (uid == undefined || uid <= 0) {
        return errorRes(res, "user id not allow empty or invalid");
      }

      const user = await prisma.users.findUnique({
        where: { id: uid, status: 1 },
      });
      if (!user) {
        return errorRes(res, "User not found");
      }

      const goldReward = await prisma.configs.findFirst({
        where: { unique_key: "freeGolds" },
      });
      if (!goldReward) {
        return errorRes(res, "config not found");
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const oneDay = 24 * 60 * 60;
      if (
        user.last_get_free_gold_time &&
        currentTime - user.last_get_free_gold_time < oneDay
      ) {
        return errorRes(res, "Cannot claim now");
      }

      const goldAmount = BigInt(goldReward.value);
      await prisma.users.update({
        where: { id: uid },
        data: {
          gold_amount: {
            increment: goldAmount,
          },
          last_get_free_gold_time: currentTime,
        },
      });

      await logAction("get_free_gold", `uid:${uid},amount:${goldAmount}`);

      successRes(res, { addAmount: goldAmount.toString() });
    } catch (error) {
      errorRes(res, (error as Error).message);
    }
  },
];

export const getFreeDiamonds = [
  async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      if (uid == undefined || uid <= 0) {
        return errorRes(res, "user id not allow empty or invalid");
      }

      const user = await prisma.users.findUnique({
        where: { id: uid, status: 1 },
      });
      if (!user) {
        return errorRes(res, "User not found");
      }
      const diamondReward = await prisma.configs.findFirst({
        where: { unique_key: "freeDiamonds" },
      });

      if (!diamondReward) {
        return errorRes(res, "config not found");
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const oneDay = 24 * 60 * 60;
      if (
        user.last_getfree_diamond_time &&
        currentTime - user.last_getfree_diamond_time < oneDay
      ) {
        return errorRes(res, "Cannot claim now");
      }

      const addAmount = BigInt(diamondReward.value);

      await prisma.users.update({
        where: { id: uid },
        data: {
          diamond_amount: {
            increment: addAmount,
          },
          last_getfree_diamond_time: currentTime,
        },
      });

      await logAction("get_free_diamonds", `uid:${uid},amount:${addAmount}`);

      successRes(res, {
        addAmount: addAmount.toString(),
      });
    } catch (error) {
      errorRes(res, (error as Error).message);
    }
  },
];
