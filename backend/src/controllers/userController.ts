import {  Request, Response } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient, users } from "@prisma/client";
import { successRes, errorRes } from "../utils/responseHandler";
import { logAction } from "../utils/logger";
import { usersToken } from "../models/models";
import { cacheMiddleware } from "../middlewares/cacheMiddleware";
import { updateTimeMiddleware } from "../middlewares/updateTime";
import { createSelectFields } from "../utils/tools";
import { prisma } from "../utils/prismaInstance";
import _ from "lodash";
import { TonClient, Address, Cell, JettonMaster, fromNano, beginCell } from "@ton/ton";
import { getHttpEndpoint } from "@orbs-network/ton-access";
import axios from "axios";
import cron from "node-cron";

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";
const API_KEY = process.env.TON_API_KEY;


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
        "invite_number",
      ];

      const selectField = createSelectFields(fields);
      const user = (await prisma.users.findUnique({
        select: selectField,
        where: { id: uid, status: 1 },
      })) as users | null;

      if (!user) {
        return errorRes(res, "User not found");
      }

      const userResponse = {
        ...user,
        gold_amount: user.gold_amount?.toString(),
        diamond_amount: user.diamond_amount?.toString(),
        buy_usdt: user.buy_usdt?.toString(),
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

// export const createUser = [
//   async (req: Request, res: Response) => {
//     try {
//       const { telegram_id, invite_code, address } = req.body;

//       // 判断所有入参
//       if (!telegram_id || !address) {
//         return errorRes(res, "telegram_id and address are required");
//       }

//       const fruits = await prisma.fruit.findMany();

//       let user = await prisma.users.findUnique({ where: { telegram_id } });
//       if (user) {
//         return errorRes(res, "User already exists");
//       }

//       user = await prisma.users.create({
//         data: {
//           telegram_id,
//           username: telegram_id.toString(),
//           address,
//           invite_code: await generateInviteCode(telegram_id),
//           create_time: Math.floor(Date.now() / 1000),
//         },
//       });

//       const initialFruits = fruits.map((fruit) => ({
//         uid: user.id,
//         fruit_id: fruit.fruit_id,
//         quality: fruit.quality,
//         attack: fruit.attack,
//         atk_speed: fruit.attack_speed,
//         baojilv: fruit.baojilv,
//         baoji: fruit.baoji,
//         fruit_number: fruit.unlock === 0 ? 1 : 0,
//         create_time: Math.floor(Date.now() / 1000),
//       }));

//       await prisma.user_bag.createMany({
//         data: initialFruits,
//       });

//       if (invite_code) {
//         try {
//           await useInviteCode(telegram_id, invite_code);
//         } catch (error) {
//           return errorRes(res, (error as Error).message);
//         }
//       }

//       await logAction(
//         "CREATE_USER",
//         `User created with telegram_id: ${telegram_id} code ${invite_code}`
//       );

//       const userResponse = {
//         ...user,
//         telegram_id: user.telegram_id.toString(),
//         gold_amount: user.gold_amount.toString(),
//         diamond_amount: user.diamond_amount.toString(),
//         buy_usdt: user.buy_usdt.toString(),
//       };

//       res.status(201);
//       successRes(res, {
//         message: "User created",
//         user: userResponse,
//         invite_code: userResponse.invite_code,
//       });
//     } catch (error) {
//       errorRes(res, (error as Error).message);
//     }
//   },
// ];

export const generateInviteCode = async (
  telegram_id: bigint
): Promise<string> => {
  const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();
  // await logAction(
  //   "generate_invite_code",
  //   `tgId:${telegram_id}`
  // );
  return invite_code;
};

export const useInviteCode = async (
  telegram_id: bigint,
  invite_code: string
): Promise<void> => {
  const referrer = await prisma.users.findUnique({
    where: { invite_code },
  });

  if (!referrer) {
    throw new Error("Referrer not found");
  }

  await prisma.users.update({
    where: { telegram_id },
    data: {
      referred_by: referrer.id,
    },
  });

  await prisma.users.update({
    where: { invite_code },
    data: {
      gold_amount: BigInt(referrer.gold_amount) + BigInt(100),
      diamond_amount: BigInt(referrer.diamond_amount) + BigInt(10),
      invite_number: (referrer.invite_number ?? 0) + 1,
    },
  });

  await logAction(
    "use_invite_code",
    `User ${telegram_id} used invite code ${invite_code}`
  );
};

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
        select: { id: true, address: true, telegram_id: true },
        where: { telegram_id: bigTelegram_id, status: 1 },
      });
      if (_.isEmpty(user)) {
        //未找到用户  新创建一个
        user = await prisma.users.create({
          data: {
            telegram_id,
            invite_code: await generateInviteCode(telegram_id),
            create_time: Math.floor(Date.now() / 1000),
          },
        });
        await logAction("create_user", `tgId:${telegram_id}`);
      }
      // 生成 JWT
      const userKey = {
        uid: user.id,
        telegram_id: user.telegram_id.toString(),
        address: user.address,
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


async function handlerBuyToken() {
  const data = await decodeTransaction();
  console.log(data);

  // 10,1000;68,7000;128,14800;328,36800
  const diamondMap: Record<number, number> = {
    0.01: 10,
    0.02: 20,
    10: 1000,
    68: 7000,
    128: 14800,
    328: 36800
  };

  if (_.isEmpty(data)) return;


  type AmountEntry = {
    hash: string;
    amount: number;
    comment: string;
  };

  const tgIds: Set<string> = new Set(); // 用于存储唯一的tg_id
  const amounts = new Set<AmountEntry>(); // 用于存储唯一的amount
  const transactionHashes = Object.keys(data);

  transactionHashes.forEach(hash => {
    const element = data[hash];
    const comment = hexToString(element.comment);
    const amount = Number(element.amount) * 1000;

    if (comment.includes("tg_id") && diamondMap[amount]) {
      const tgId = comment.split(":")[1];
      if (tgId) {
        tgIds.add(tgId);
        amounts.add({ hash, amount, comment }); // 使用 Set 的 add 方法
      }
    }
  });

  console.log(amounts);

  const userRes = await prisma.users.findMany({
    where: {
      telegram_id: {
        in: Array.from(tgIds).map(tgId => parseInt(tgId)),
      }
    },
    select: { id: true, telegram_id: true }
  });

  const userMap: Record<string, number> = {};
  userRes.forEach(user => {
    userMap[user.telegram_id.toString()] = user.id;
  });

  const transactionLogs:any = [];
  const logActions:any = [];
  const currentTime = Math.floor(Date.now() / 1000);
  for (const { hash, amount, comment } of amounts) {
    if (await prisma.transaction_log.findUnique({ where: { hash } })) {
      continue;
    }
    const tgId = comment.split(":")[1];
    const uid = userMap[tgId];
    if (!uid) {
      console.log(`User not found for tg_id: ${tgId}`);
      continue;
    }

    const diamondAmount = diamondMap[amount];
    transactionLogs.push({ hash, amount: amount.toString(), comment });
    logActions.push({action:"buy_tokens",memo:`uid:${uid},usdt:${amount},diamond:${diamondAmount}`,create_time:currentTime});
    await prisma.users.update({
      where: { id: uid },
      data: {
        diamond_amount: {
          decrement: BigInt(diamondAmount),
        },
        update_time: currentTime,
      },
    });
  }

  if (transactionLogs.length > 0) {
    await prisma.transaction_log.createMany({
      data: transactionLogs
    });
  }
  if (logActions.length > 0) {
    await prisma.logs.createMany({
      data: logActions
    });
  }
}

function hexToString(hex: string) {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  return str;
}

//从ton client 获取交易记录
async function decodeTransaction() {
  const endpoint = await getHttpEndpoint({
    network: "mainnet",
  });

  const client = new TonClient({
    endpoint,
    apiKey: API_KEY,
  });

  const contractAddress = Address.parse(CONTRACT_ADDRESS);
  const USDT_CONTRACT_ADDRESS = Address.parse(process.env.USDT_CONTRACT_ADDRESS || "");

  //获取usdt的地址
  const trans = await client.getTransactions(contractAddress, { limit: 20 });

  //判断该hash 是否已经处理过
  let returnData: Record<string, object> = {};
  for (const tx of trans) {
    const inMsg = tx.inMessage;
    // const hashBase64 = tx.hash().toString("base64");
    const hash = tx.hash().toString("hex");

    if (inMsg?.info.type == 'internal') {
      let transAmount;
      let comment;
      // we only process internal messages here because they are used the most
      // for external messages some of the fields are empty, but the main structure is similar
      const sender = inMsg?.info.src;
      const value = inMsg?.info.value.coins;
      const originalBody = inMsg?.body.beginParse();
      let body = originalBody.clone();
      if (body.remainingBits < 32) {
        // if body doesn't have opcode: it's a simple message without comment
        console.log(`Simple transfer from ${sender} with value ${fromNano(value)} TON`);
      } else {
        const op = body.loadUint(32);
        console.log("op", op);
        if (op == 0) {
          // if opcode is 0: it's a simple message with comment
          comment = body.loadStringTail();
          console.log(
            `Simple transfer from ${sender} with value ${fromNano(value)} TON and comment: "${comment}"`
          );
          continue;
        } else if (op == 0x7362d09c) {
          // if opcode is 0x7362d09c: it's a Jetton transfer notification
          body.skip(64); // skip query_id
          const jettonAmount = body.loadCoins();
          const jettonSender = body.loadAddressAny();
          const originalForwardPayload = body.loadBit() ? body.loadRef().beginParse() : body;
          let forwardPayload = originalForwardPayload.clone();

          // IMPORTANT: we have to verify the source of this message because it can be faked
          const runStack = (await client.runMethod(sender, 'get_wallet_data')).stack;
          runStack.skip(2);
          const jettonMaster = runStack.readAddress();
          if (!jettonMaster.equals(USDT_CONTRACT_ADDRESS)) {
            // if sender is not our real JettonWallet: this message was faked
            console.log(`not usdt,skip`);
            continue;
          }
          const jettonWallet = (
            await client.runMethod(jettonMaster, 'get_wallet_address', [
              { type: 'slice', cell: beginCell().storeAddress(contractAddress).endCell() },
            ])
          ).stack.readAddress();
          if (!jettonWallet.equals(sender)) {
            // if sender is not our real JettonWallet: this message was faked
            console.log(`FAKE Jetton transfer`);
            continue;
          }

          if (forwardPayload.remainingBits < 32) {
            // if forward payload doesn't have opcode: it's a simple Jetton transfer
            console.log(`Jetton transfer from ${jettonSender} with value ${fromNano(jettonAmount)} Jetton`);
          } else {
            const forwardOp = forwardPayload.loadUint(32);
            if (forwardOp == 0) {
              // if forward payload opcode is 0: it's a simple Jetton transfer with comment
              comment = forwardPayload.loadStringTail();
              transAmount = fromNano(jettonAmount);
              console.log(jettonAmount);
              console.log(
                `Jetton transfer from ${jettonSender} with value ${fromNano(
                  jettonAmount
                )} Jetton and comment: "${comment}"`
              );
            } else {
              // if forward payload opcode is something else: it's some message with arbitrary structure
              // you may parse it manually if you know other opcodes or just print it as hex
              console.log(
                `Jetton transfer with unknown payload structure from ${jettonSender} with value ${fromNano(
                  jettonAmount
                )} Jetton and payload: ${originalForwardPayload}`
              );
            }

            console.log(`Jetton Master: ${jettonMaster}`);
          }
        } else {
          // if opcode is something else: it's some message with arbitrary structure
          // you may parse it manually if you know other opcodes or just print it as hex
          console.log(
            `Message with unknown structure from ${sender} with value ${fromNano(
              value
            )} TON and body: ${originalBody}`
          );
        }
      }
      if (transAmount && comment) {
        returnData[hash] = {
          lt: tx.lt,
          amount: transAmount,
          comment: comment
        };
      }
    }
  }

  return returnData;
}

// 从api 获取交易记录
async function listenToDepositEvent(
  uid: number
): Promise<{ amount: number } | null> {
  return new Promise(async (resolve, reject) => {
    try {
      const endpoint = await getHttpEndpoint({
        network: "mainnet",
      });

      console.log(endpoint);

      const client = new TonClient({
        endpoint,
        apiKey: API_KEY,
      });
      console.log("asdklfmasdklfjmaklsdjmf");

      // const contractAddress = new Address(CONTRACT_ADDRESS);
      const contractAddress = Address.parse(CONTRACT_ADDRESS);

      const jettonMasterAddress = Address.parse(process.env.USDT_CONTRACT_ADDRESS || "");
      const jettonMaster = client.open(JettonMaster.create(jettonMasterAddress));
      const jettonWallet = await jettonMaster.getWalletAddress(contractAddress);

      // console.log(contractAddress);
      console.log(await client.getBalance(jettonWallet));
      //获取usdt的地址

      const response = await axios.get('https://toncenter.com/api/v3/transactions?account=EQB_nrhhBe3hVP3sYsLIii0EePisGhnFACE_wT2F7Jk96XQF&sort=desc');

      if (!_.isEmpty(response.data)) {

        const transactions = response.data.transactions;
        console.log(transactions.length);

        for (const tx of transactions) {

          console.log(tx);
          const trace_id = tx.trace_id;
          const inMsg = tx.in_msg;
          console.log(inMsg);
          const body = inMsg.message_content.body;
          const cell = Cell.fromBoc(Buffer.from(body, 'base64'))[0];
          console.log(cell);

          console.log(cell.beginParse());

          const source = Address.parseRaw(inMsg.source);
          console.log(source);
          console.log(trace_id);
          // console.log(body);
          break;
        }
      }
      // const trans = await client.getTransactions(contractAddress,{limit:10});

      // console.log(trans.length);
      return;
      const timeout = setTimeout(() => {
        console.log("Deposit event listening timeout");
        resolve(null);
      }, 60000);

      console.log(
        `Starting to listen for deposits for user ${uid} on contract ${CONTRACT_ADDRESS}`
      );


      const subscription = client.createSubscription();
      console.log(subscription);
      await subscription.transactions(contractAddress, {
        onMessage: async (tx: any) => {
          try {

            const messages = tx.inMessage?.body;
            if (!messages) return;

            // 解码
            const decoded = decodeDepositMessage(messages);
            if (decoded && decoded.uid === uid) {
              console.log("Deposit event detected:", decoded);
              clearTimeout(timeout);
              subscription.unsubscribe();
              resolve({ amount: decoded.amount });
            }
          } catch (error) {
            console.error("Error processing transaction:", error);
          }
        },
        onError: (error: any) => {
          console.error("Subscription error:", error);
          reject(error);
        },
      });
    } catch (error) {
      console.error("Error setting up deposit listener:", error);
      reject(error);
    }
  });
}

// 解码
function decodeDepositMessage(
  message: Cell
): { uid: number; amount: number } | null {
  try {
    const slice = message.beginParse();

    const op = slice.loadUint(32);
    if (op !== 0x12345678) {
      // 替换真实码
      return null;
    }

    const uid = slice.loadUint(32);
    const amount = slice.loadCoins();

    return {
      uid: Number(uid),
      amount: Number(amount) / 1e9,
    };
  } catch (error) {
    console.error("Error decoding deposit message:", error);
    return null;
  }
}

async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.error(`Retry ${i + 1}/${maxRetries} failed:`, error);
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw lastError;
}
