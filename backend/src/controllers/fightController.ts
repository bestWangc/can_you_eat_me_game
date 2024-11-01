import { Request, Response } from "express";
import { PrismaClient, fruit, users } from "@prisma/client";
import { successRes, errorRes } from "../utils/responseHandler";
import { logAction } from "../utils/logger";
import { openBoxCore } from "./shopController";
import { Fruit } from "../models/models";
import { cacheMiddleware } from "../middlewares/cacheMiddleware";
import _ from "lodash";
import { prisma } from "../utils/prismaInstance";
import Redis from "ioredis";

export const dailySignIn = [
  async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return errorRes(res, "user id is required");
      }
      const user = await prisma.users.findUnique({
        select: { id: true, last_sign_time: true, sign_day: true, level_id: true, referred_by: true },
        where: { id: uid, status: 1 },
      });
      const rewardBase = await prisma.configs.findUnique({
        where: {
          unique_key: "rewardBase",
        },
      });
      if (!user || !rewardBase) {
        return errorRes(res, "User and Configs not found");
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const oneDay = 24 * 60 * 60;

      if (user.last_sign_time && currentTime - user.last_sign_time < oneDay) {
        return errorRes(res, "only sign in once a day");
      }

      if (user.level_id <= 0) {
        return errorRes(res, "Something wrong, please try again later");
      }

      const signDay = user.sign_day ?? 0;
      let newSignDay = signDay + 1;
      const rewardGold = user.level_id * Number(rewardBase.value);
      const rewardDiamond = signDay * Number(rewardBase.value) * 0.2;

      await prisma.users.update({
        where: { id: uid },
        data: {
          gold_amount: {
            increment: BigInt(rewardGold),
          },
          diamond_amount: {
            increment: BigInt(rewardDiamond),
          },
          sign_day: {
            increment: 1,
          },
          last_sign_time: currentTime,
          update_time: currentTime,
        },
      });

      if (user.referred_by) {
        const inviteReward = BigInt(rewardGold * 5) / BigInt(100);
        await prisma.users.update({
          where: {
            id: user.referred_by,
          },
          data: {
            gold_amount: {
              increment: inviteReward,
            },
            invite_rewards: {
              increment: inviteReward,
            },
          },
        });
      }

      await logAction(
        "daily_sign_in",
        `uid:${uid},reward:${rewardGold};${rewardDiamond},oldDay:${signDay},newDay:${newSignDay}`
      );

      successRes(res, {
        signDay: newSignDay,
        rewardGold: rewardGold,
        rewardDiamond: rewardDiamond,
        signTime: currentTime,
      });
    } catch (error) {
      errorRes(res, (error as Error).message);
    }
  },
];

export const startGame = [
  // cacheMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { level_id } = req.body;
      const uid = req.user?.uid;
      if (!uid) {
        return errorRes(res, "User need");
      }

      const user = await prisma.users.findUnique({
        where: { id: uid, status: 1 },
      });

      if (_.isEmpty(user)) {
        return errorRes(res, "User not found");
      }

      //获取游戏开始价格
      const config = await prisma.configs.findFirst({
        select: { value: true },
        where: { unique_key: "startGamePrice", status: 1 },
      });
      if (_.isEmpty(config)) {
        return errorRes(res, "config not found");
      }
      const gameCostGold: number = parseInt(config.value);
      const gameCostGoldBig = BigInt(gameCostGold);
      if (user.gold_amount < gameCostGoldBig) {
        return errorRes(res, "Not enough gold");
      }

      let user_fights;

      await prisma.$transaction(async (prisma) => {
        await prisma.users.update({
          where: { id: uid },
          data: {
            gold_amount: {
              decrement: gameCostGoldBig,
            },
          },
        });

        // user_fights = await prisma.user_fight.findUnique({
        //   where: {
        //     uid_level_id: {
        //       uid: uid,
        //       level_id,
        //     },
        //   },
        // });

        // if (!user_fights) {
        user_fights = await prisma.user_fight.create({
          data: {
            uid: uid,
            level_id,
            cost_gold: gameCostGold,
            create_time: Math.floor(Date.now() / 1000),
          },
        });
        // }
        // else {
        //   user_fights = await prisma.user_fight.update({
        //     where: {
        //       uid_level_id: {
        //         uid: user.id,
        //         level_id,
        //       },
        //     },
        //     data: {
        //       cost_gold: {
        //         increment: gameCostGold,
        //       },
        //     },
        //   });
        // }

        await logAction(
          "start_game",
          `uid:${uid},level_id:${level_id},cost_gold:${gameCostGold}`
        );
      });

      successRes(res, { user_fights });
    } catch (error) {
      errorRes(res, (error as Error).message);
    }
  },
];

async function allocateFruitFragments(quality: number, fragmentCount: number) {
  const fruits = await prisma.fruit.findMany({
    select: { fruit_id: true },
    where: { quality },
  });

  if (fruits.length === 0) {
    throw new Error("No fruits found with the specified quality");
  }

  const allocatedFragments: Record<number, number> = {};

  for (let i = 0; i < fragmentCount; i++) {
    const randomIndex = Math.floor(Math.random() * fruits.length);
    const selectedFruitId = fruits[randomIndex].fruit_id;

    if (!allocatedFragments[selectedFruitId]) {
      allocatedFragments[selectedFruitId] = 0;
    }
    allocatedFragments[selectedFruitId]++;
  }

  return allocatedFragments;
}

async function fightRewardCore(
  total: number,
  quality: number
): Promise<Record<number, number>> {
  const fruits = await prisma.fruit.findMany({
    where: { quality, status: 1 },
    select: { fruit_id: true },
  });

  if (fruits.length === 0) {
    throw new Error("No fruits found with the specified quality");
  }

  const fruitIds = fruits.map((fruit) => fruit.fruit_id);
  const fragments = Array(fruitIds.length).fill(0);
  const guaranteedFragments = getRandomInt(1, 2);

  const guaranteedIndex = getRandomInt(0, fruitIds.length - 1);
  fragments[guaranteedIndex] = guaranteedFragments;

  const remainingFragments = total - guaranteedFragments;
  for (let i = 0; i < remainingFragments; i++) {
    const index = getRandomInt(0, fruitIds.length - 1);
    fragments[index]++;
  }

  const result: Record<number, number> = {};
  fruitIds.forEach((fruitId, index) => {
    if (fragments[index] > 0) {
      result[fruitId] = fragments[index];
    }
  });

  return result;
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const winLevelReward = [
  async (req: Request, res: Response) => {
    try {
      const { level_id, reward_add } = req.body;

      if (!level_id) {
        return errorRes(res, "level is require");
      }
      let rewardAdd = 0;
      if (reward_add) {
        rewardAdd = reward_add;
      }

      const uid = req.user?.uid;
      if (!uid) {
        return errorRes(res, "user need");
      }

      const user = await prisma.users.findUnique({
        where: { id: uid, status: 1 },
      });
      if (!user) {
        return errorRes(res, "User not found");
      }

      const currentLevelId = user.level_id;

      const level = await prisma.levels.findUnique({
        where: {
          id: level_id,
        },
      });

      if (_.isEmpty(level)) {
        return errorRes(res, "Level not found");
      }

      const user_fight = await prisma.user_fight.findFirst({
        where: {
          uid: user.id,
          level_id,
        },
        orderBy: {
          id: "desc",
        },
        take: 1,
      });

      console.log(user_fight, "--------------11");

      if (user_fight?.fight_win != 0) {
        return errorRes(
          res,
          "Level not found,The game has not yet achieved victory"
        );
      }

      const currentUserFightId = user_fight.id;

      const levelAwardData = level.level_award.split(";");
      console.log("----------2", levelAwardData);

      const updatedLevelAwardData: string[] = levelAwardData.map(
        (item: string): string => {
          const parts: string[] = item.split(",");
          const lastIndex: number = parts.length - 1;
          parts[lastIndex] = Math.round(
            Number(parts[lastIndex]) * (1 + reward_add)
          ).toString();
          return parts.join(",");
        }
      );
      console.log("----------3", updatedLevelAwardData);

      let goldAmount = user.gold_amount;
      let newGoldAmount = BigInt(0);
      let allocatedFragments: Record<number, number> = {};

      for (const award of updatedLevelAwardData) {
        let [type, ...values] = award.split(",").map(Number);
        // values = values.map((value) => value * reward_add);

        if (type === 1) {
          const gold = values[0];
          goldAmount += BigInt(gold);
          newGoldAmount += BigInt(gold);
        } else if (type === 5) {
          const quality = values[0];
          const fragmentCount = values[1];

          const fragments = await fightRewardCore(fragmentCount, quality);

          for (const [fruitId, count] of Object.entries(fragments)) {
            const fruitIdNum = Number(fruitId);
            if (!allocatedFragments[fruitIdNum]) {
              allocatedFragments[fruitIdNum] = 0;
            }
            allocatedFragments[fruitIdNum] += count;

            const userBag = await prisma.user_bag.findUnique({
              where: {
                uid_fruit_id: {
                  uid: user.id,
                  fruit_id: fruitIdNum,
                },
              },
            });

            if (userBag) {
              await prisma.user_bag.update({
                where: {
                  uid_fruit_id: {
                    uid: user.id,
                    fruit_id: fruitIdNum,
                  },
                },
                data: {
                  fruit_number: 1,
                  fragments: {
                    increment: count,
                  },
                },
              });
            } else {
              await prisma.user_bag.create({
                data: {
                  uid: user.id,
                  fruit_id: fruitIdNum,
                  fruit_number: 1,
                  fragments: count,
                  create_time: Math.floor(Date.now() / 1000),
                },
              });
            }
          }
        }
      }

      await prisma.$transaction(async (prisma) => {
        await prisma.users.update({
          where: { id: uid },
          data: {
            gold_amount: {
              increment: newGoldAmount,
            },
            ...(level_id > currentLevelId ? { level_id } : {}),
          },
        });

        await prisma.user_fight.update({
          where: {
            uid: user.id,
            id: currentUserFightId,
          },
          data: {
            fight_win: 1,
          },
        });

        if (user.referred_by) {
          const inviteReward = (newGoldAmount * BigInt(5)) / BigInt(100);
          await prisma.users.update({
            where: {
              id: user.referred_by,
            },
            data: {
              gold_amount: {
                increment: inviteReward,
              },
              invite_rewards: {
                increment: inviteReward,
              },
            },
          });
        }

        await logAction(
          "win_level_reward",
          `uid:${uid},level:${level_id},reward${newGoldAmount.toString()},${allocatedFragments} `
        );
      });

      //清除缓存
      const cacheKey = uid + "-fruit-bags";
      const redis = new Redis();
      await redis.setex(cacheKey, 1, "");

      successRes(res, {
        newGoldAmount: newGoldAmount.toString(),
        allocatedFragments,
      });
    } catch (error) {
      errorRes(res, (error as Error).message);
    }
  },
];

export const openLevelRewardBox = [
  async (req: Request, res: Response) => {
    try {
      const { level_id, award_box_number } = req.body;

      if (!level_id) {
        return errorRes(res, "level need");
      }
      if (!award_box_number) {
        return errorRes(res, "box need");
      }
      const awardBoxNumber = parseInt(award_box_number);

      const uid = req.user?.uid;
      if (!uid) {
        return errorRes(res, "user need");
      }

      const user = await prisma.users.findUnique({
        where: { id: uid, status: 1 },
      });

      if (!user) {
        return errorRes(res, "User not found");
      }

      const user_fight = await prisma.user_fight.findFirst({
        where: {
          uid: uid,
          level_id,
          fight_win: 1,
        },
        orderBy: { id: "desc" },
      });

      if (_.isEmpty(user_fight)) {
        return errorRes(res, "user Fight not found");
      }

      //查询obtain_box
      const userFightBox = await prisma.user_fight_box.findFirst({
        where: {
          uid: user.id,
          level_id,
        },
      });

      let obtainBoxInfo = "";
      let needInsertObtainBox = false;
      let userFightBoxId = 0;
      if (_.isEmpty(userFightBox)) {
        needInsertObtainBox = true;
        obtainBoxInfo = "5,0;10,0;20,0";
      } else {
        obtainBoxInfo = userFightBox.obtain_box;
        userFightBoxId = userFightBox.id;
      }

      const levelAwardData = obtainBoxInfo.split(";");

      let boxFound = false;

      for (let i = 0; i < levelAwardData.length; i++) {
        const [boxLevel, boxStatus] = levelAwardData[i].split(",").map(Number);
        if (boxLevel === awardBoxNumber) {
          boxFound = true;
          console.log(boxStatus);
          if (boxStatus === 1) {
            return errorRes(res, "Box already claimed");
          }
          levelAwardData[i] = `${boxLevel},1`;
        }
      }
      if (!boxFound) {
        return errorRes(res, "Invalid award box number");
      }

      const level = await prisma.levels.findUnique({
        where: {
          id: level_id,
        },
        select: {
          award_box_1: true,
          award_box_2: true,
          award_box_3: true,
        },
      });

      if (!level) {
        return errorRes(res, "User and Level not found");
      }

      let awardBoxField: string | undefined;
      if (awardBoxNumber === 5) {
        awardBoxField = level.award_box_1;
      } else if (awardBoxNumber === 10) {
        awardBoxField = level.award_box_2;
      } else if (awardBoxNumber === 20) {
        awardBoxField = level.award_box_3;
      }

      if (!awardBoxField) {
        return errorRes(res, "No data found for the specified award box");
      }

      const boxData = awardBoxField.split(";");

      let newGoldAmount = BigInt(0);
      let newDiamondAmount = BigInt(0);
      let allocatedFragments: Record<number, number> = {};

      for (const award of boxData) {
        const [type, ...values] = award.split(",").map(Number);

        if (type === 1) {
          const gold = values[0];
          newGoldAmount += BigInt(gold);
        } else if (type === 2) {
          const diamonds = values[0];
          newDiamondAmount += BigInt(diamonds);
        } else if (type === 5) {
          const quality = values[0];
          const fragmentCount = values[1];
          const fragments = await fightRewardCore(fragmentCount, quality);
          for (const [fruitId, count] of Object.entries(fragments)) {
            const fruitIdNum = Number(fruitId);
            if (!allocatedFragments[fruitIdNum]) {
              allocatedFragments[fruitIdNum] = 0;
            }
            allocatedFragments[fruitIdNum] += count;
            const userBag = await prisma.user_bag.findUnique({
              where: {
                uid_fruit_id: {
                  uid: uid,
                  fruit_id: fruitIdNum,
                },
              },
            });

            if (userBag) {
              await prisma.user_bag.update({
                where: {
                  uid_fruit_id: {
                    uid: uid,
                    fruit_id: fruitIdNum,
                  },
                },
                data: {
                  fragments: {
                    increment: count,
                  },
                  fruit_number: 1,
                },
              });
            } else {
              await prisma.user_bag.create({
                data: {
                  uid: uid,
                  fruit_id: fruitIdNum,
                  fruit_number: 1,
                  fragments: count,
                  create_time: Math.floor(Date.now() / 1000),
                },
              });
            }
          }
        }
      }

      //清除缓存
      const cacheKey = uid + "-fruit-bags";
      const redis = new Redis();
      await redis.setex(cacheKey, 1, "");

      let updatedObtainBox = levelAwardData.join(";");
      await prisma.$transaction(async (prisma) => {
        await prisma.users.update({
          where: { id: uid },
          data: {
            gold_amount: {
              increment: newGoldAmount,
            },
            diamond_amount: {
              increment: newDiamondAmount,
            },
          },
        });
        if (user.referred_by) {
          const inviteReward = (newGoldAmount * BigInt(5)) / BigInt(100);
          await prisma.users.update({
            where: {
              id: user.referred_by,
            },
            data: {
              gold_amount: {
                increment: inviteReward,
              },
              invite_rewards: {
                increment: inviteReward,
              },
            },
          });
        }

        if (needInsertObtainBox) {
          await prisma.user_fight_box.create({
            data: {
              uid: uid,
              level_id: level_id,
              obtain_box: updatedObtainBox,
              create_time: Math.floor(Date.now() / 1000),
            },
          });
        } else {
          await prisma.user_fight_box.update({
            where: {
              id: userFightBoxId,
            },
            data: {
              obtain_box: updatedObtainBox,
            },
          });
        }
      });
      await logAction(
        "open_level_reward_box",
        `uid:${uid},level:${level_id},award_box_number:${award_box_number}`
      );

      successRes(res, {
        level_id,
        BoxCollectionStatus: updatedObtainBox,
        newGoldAmount: newGoldAmount.toString(),
        newDiamondAmount: newDiamondAmount.toString(),
        allocatedFragments,
      });
    } catch (error) {
      errorRes(res, (error as Error).message);
    }
  },
];

export const getUserFightObtainBox = [
  async (req: Request, res: Response) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return errorRes(res, "user need");
      }

      const userFightBox = await prisma.user_fight_box.findMany({
        where: { uid },
        select: {
          level_id: true,
          obtain_box: true,
        },
      });

      if (_.isEmpty(userFightBox)) {
        return successRes(res, {});
      }

      const obtainBoxData: Record<number, string> = {};
      userFightBox.forEach((fight) => {
        obtainBoxData[fight.level_id] = fight.obtain_box;
      });

      successRes(res, obtainBoxData);
    } catch (error) {
      errorRes(res, (error as Error).message);
    }
  },
];

export const recordFightLog = [
  async (req: Request, res: Response) => {
    try {
      const { uid, talent_id, cost_golds, cost_diamonds } = req.body;

      if (!uid || !talent_id) {
        return errorRes(res, "uid and talent_id not found");
      }

      const userFight = await prisma.user_fight.findFirst({
        where: { uid },
      });

      if (!userFight) {
        return errorRes(res, "User fight data not found");
      }

      const userBag = await prisma.user_bag.findMany({
        where: { uid },
      });

      if (userBag.length === 0) {
        return errorRes(res, "User backpack data not found");
      }

      for (const bagItem of userBag) {
        const existingLog = await prisma.user_fight_logs.findUnique({
          where: {
            uid_level_id_fruit_id: {
              uid,
              level_id: userFight.level_id,
              fruit_id: bagItem.fruit_id,
            },
          },
        });

        if (existingLog) {
          await prisma.user_fight_logs.update({
            where: {
              uid_level_id_fruit_id: {
                uid,
                level_id: userFight.level_id,
                fruit_id: bagItem.fruit_id,
              },
            },
            data: {
              fruit_attack: bagItem.attack,
              fruit_atk_speed: bagItem.atk_speed,
              fruit_baojilv: bagItem.baojilv,
              fruit_baoji: bagItem.baoji,
              talent_id,
              cost_golds: { increment: cost_golds },
              cost_diamonds: { increment: cost_diamonds },
              // update_time: new Date(),
            },
          });
        } else {
          await prisma.user_fight_logs.create({
            data: {
              uid,
              // address: userFight.address,
              level_id: userFight.level_id,
              fruit_id: bagItem.fruit_id,
              fruit_attack: bagItem.attack,
              fruit_atk_speed: bagItem.atk_speed,
              fruit_baojilv: bagItem.baojilv,
              fruit_baoji: bagItem.baoji,
              talent_id,
              create_time: Math.floor(Date.now() / 1000),
            },
          });
        }
      }

      successRes(res, { msg: "Battle log recording successful" });
    } catch (error) {
      errorRes(res, (error as Error).message);
    }
  },
];

export const refreshTalent = [
  async (req: Request, res: Response) => {
    try {
      const { uid, costDiamonds, costGold, buffId } = req.body;

      if (!uid || (!costDiamonds && !costGold) || !buffId) {
        return errorRes(
          res,
          "uid and buffId、costDiamonds、costGold not found"
        );
      }

      const user = await prisma.users.findUnique({
        where: { id: uid },
      });

      if (!user) {
        return errorRes(res, "user not found");
      }

      if (costGold && user.gold_amount < BigInt(costGold)) {
        return errorRes(res, "Insufficient gold coins");
      }

      if (costDiamonds && user.diamond_amount < BigInt(costDiamonds)) {
        return errorRes(res, "Diamond shortage");
      }

      await prisma.users.update({
        where: { id: uid },
        data: {
          gold_amount: user.gold_amount - BigInt(costGold || 0),
          diamond_amount: user.diamond_amount - BigInt(costDiamonds || 0),
        },
      });

      await prisma.user_fight_logs.updateMany({
        where: { uid },
        data: {
          talent_id: buffId,
          // update_time: new Date(),
        },
      });

      successRes(res, { msg: "Talent buff refresh successful" });
    } catch (error) {
      errorRes(res, (error as Error).message);
    }
  },
];

export const costToken = [
  async (req: Request, res: Response) => {
    try {
      // token_type为消耗token类型 1为钻石2为金币
      const { config_key, token_type } = req.body;

      if (_.isEmpty(config_key)) {
        return errorRes(res, "key is required");
      }

      const uid = req.user?.uid;
      if (!uid) {
        return errorRes(res, "user id is required");
      }

      const user = await prisma.users.findUnique({
        where: { id: uid },
      });

      if (_.isEmpty(user)) {
        return errorRes(res, "user not found");
      }
      const configCost = await prisma.configs.findFirst({
        select: { value: true },
        where: {
          unique_key: config_key,
        },
      });
      if (_.isEmpty(configCost)) {
        return errorRes(res, "configCost not found");
      }

      const costToken = Number(configCost.value);

      const tokenTypeMap: Record<
        number,
        { field: "diamond_amount" | "gold_amount"; errorMsg: string }
      > = {
        1: { field: "diamond_amount", errorMsg: "Not enough resources" },
        2: { field: "gold_amount", errorMsg: "Not enough resources" },
      };

      const tokenInfo = tokenTypeMap[token_type];

      if (!tokenInfo) {
        return errorRes(res, "Invalid tokenotype");
      }

      const { field, errorMsg } = tokenInfo;

      if ((user[field] as bigint) < BigInt(costToken)) {
        return errorRes(res, errorMsg);
      }

      const updateData: Record<string, any> = {};
      updateData[field] = { decrement: BigInt(costToken) };

      await prisma.users.update({
        where: { id: uid },
        data: updateData,
      });

      await logAction(
        "cost_user_token",
        `uid:${uid},config_key:${config_key},token_type:${token_type},cost_number:${costToken}`
      );

      successRes(res, { config_key, token_type, costToken });
    } catch (error) {
      errorRes(res, (error as Error).message);
    }
  },
];
