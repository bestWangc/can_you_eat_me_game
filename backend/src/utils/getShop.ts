import { PrismaClient, fruit } from "@prisma/client";
import { prisma } from "./prismaInstance";
import cron from "node-cron";


function getFruitQuality(): number {
  const rand = Math.random() * 100;
  if (rand <= 3) return 3; // 3% 概率返回“紫色”
  if (rand <= 68) return 1;      // 65% 概率返回 1
  return 2;                      // 剩余 32% 概率返回 2
}

function getFragmentAndPrice(): { fragments: number; diamonds: number } {
  const rand = Math.random() * 100;
  if (rand <= 60) {
    return { fragments: 3, diamonds: 15 };
  } else {
    return { fragments: 5, diamonds: 27 };
  }
}

async function refreshShopCore(
  // telegram_id: string,
  number: number
): Promise<any[]> {
  const newShops = [];
  for (let i = 0; i < number; i++) {
    const fruitQuality = getFruitQuality();
    const { fragments, diamonds } = getFragmentAndPrice();

    const fruits = await prisma.$queryRaw`
      SELECT * FROM fruit
      WHERE quality = ${fruitQuality} and status = 1
      ORDER BY RAND()
      LIMIT 1
    `;

    const fruit = (fruits as fruit[])[0];

    if (fruit) {
      newShops.push({
        fruit_id: fruit.fruit_id,
        fragments,
        diamonds,
        create_time: Math.floor(Date.now() / 1000),
      });
    }
  }
  return newShops;
}

export async function generateDailyShops() {
  try {
    const numberOfShops = 50;
    const newShops = await refreshShopCore(numberOfShops);

    await prisma.shop.createMany({
      data: newShops,
    });

    console.log("Daily shops generated successfully.");
  } catch (error) {
    console.error("Error generating daily shops:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// 0点执行
cron.schedule("0 0 * * *", async () => {
  console.log("Running daily shop generation task...");
  await generateDailyShops();
});
