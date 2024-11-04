import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { successRes, errorRes } from "../utils/responseHandler";
import { cacheMiddleware } from "../middlewares/cacheMiddleware";
import { createSelectFields } from "../utils/tools";
import { prisma } from "../utils/prismaInstance";
import _ from "lodash";
import Translator from "../utils/Translator";


export const getAllBuffs = [
    cacheMiddleware(() => "buffs"),
    async (req: Request, res: Response) => {
        const fields = ["id", "fruit_id", "memo", "type", "time", "value", "probability", "quality"];
        const selectField = createSelectFields(fields);
        try {
            const buffs = await prisma.buff.findMany({
                select: selectField,
                where: { status: 1 },
            });
            successRes(res, buffs);
        } catch (error) {
            errorRes(res, (error as Error).message);
        }
    },
];

export const getAllConfigs = [
    cacheMiddleware(() => "configs"),
    async (req: Request, res: Response) => {
        try {
            const configs = await prisma.configs.findMany({
                select: { unique_key: true, value: true },
                where: { status: 1 },
            });
            const formattedObject = Object.fromEntries(
                configs.map(item => [item.unique_key, item.value])
            );

            successRes(res, formattedObject);
        } catch (error) {
            errorRes(res, (error as Error).message);
        }
    },
];

export const getAllFruits = [
    // cacheMiddleware(() => "fruits"),
    async (req: Request, res: Response) => {
        const fields = [
            "id",
            "fruit_id",
            "name",
            "quality",
            "attack",
            "attack_speed",
            "desc",
            "little_desc",
            "baojilv",
            "baoji",
            "unlock",
            "grid_index",
        ];
        const selectField = createSelectFields(fields);
        try {
            const fruits = await prisma.fruit.findMany({
                select: selectField,
                where: {
                    status: 1,
                },
                orderBy: {
                    quality: "asc"
                }
            });
            let fruitsRes = {};
            if (!_.isEmpty(fruits)) {
                const translator = new Translator();
                fruitsRes = fruits.reduce((acc, item) => {
                    const tempKey = "_" + item.fruit_id;
                    item.name = translator.translate(item.name, "en");
                    item.desc = translator.translate(item.desc, "en");
                    acc[tempKey] = item; // 将整个对象作为值
                    return acc;
                }, {} as { [key: string]: any });
            }
            successRes(res, fruitsRes);
        } catch (error) {
            errorRes(res, (error as Error).message);
        }
    },
];

export const getAllFruitLevelUps = [
    cacheMiddleware(() => "fruitLevelUps"),
    async (req: Request, res: Response) => {
        try {
            const fruitLevelUps = await prisma.fruit_level_up.findMany();
            successRes(res, fruitLevelUps);
        } catch (error) {
            errorRes(res, (error as Error).message);
        }
    },
];

export const getAllLevels = [
    cacheMiddleware(() => "levels"),
    async (req: Request, res: Response) => {
        try {
            const fields = [
                "id",
                "name",
                "level_award",
                "wave_ids",
                "award_wave_id",
                "silver_coin",
                "award_box_1",
                "award_box_2",
                "award_box_3",
                "pic",
            ];
            const selectField = createSelectFields(fields);
            const levels = await prisma.levels.findMany({
                select: selectField,
                where: {
                    status: 1,
                },
            });
            const translator = new Translator();
            const formattedObject = levels.reduce((acc, level) => {
                const levelID: number = level.id;
                const tempData = level;
                tempData.name = translator.translate(level.name,"en");
                acc[levelID] = tempData;
                return acc;
            }, {} as Record<number, object>);

            successRes(res, formattedObject);
        } catch (error) {
            errorRes(res, (error as Error).message);
        }
    },
];

export const getAllMonsters = [
    cacheMiddleware(() => "monsters"),
    async (req: Request, res: Response) => {
        try {
            const fields = ["id", "desc", "img", "img", "blood", "speed", "exp", "is_boss", "resistance"];
            const selectField = createSelectFields(fields);
            const monsters = await prisma.monster.findMany({
                select: selectField,
                where: { status: 1 }
            });
            const formattedObject = monsters.reduce((acc, monster) => {
                const monsterId: number = monster.id;
                acc[monsterId] = monster;
                return acc;
            }, {} as Record<number, object>);

            successRes(res, formattedObject);
        } catch (error) {
            errorRes(res, (error as Error).message);
        }
    },
];

export const getAllTalents = [
    cacheMiddleware(() => "talents"),
    async (req: Request, res: Response) => {
        try {
            const fields = ["id", "fruit_id", "desc", "value", "unlock"];
            const selectField = createSelectFields(fields);
            const talents = await prisma.talent.findMany({
                select:selectField,
                where: { status: 1 }
            });
            const translator = new Translator();
            const formattedArray = talents.map(talent => {
                const tempData = { ...talent }; // 创建 talent 的副本
                tempData.desc = translator.translate(talent.desc, "en");
                return tempData; // 返回翻译后的对象
            });

            successRes(res, formattedArray);
        } catch (error) {
            errorRes(res, (error as Error).message);
        }
    },
];

export const getAllWaves = [
    cacheMiddleware(() => "waves"),
    async (req: Request, res: Response) => {
        try {
            const fields = [
                "id",
                "monster_id",
                "blood_multiply"
            ];
            const selectField = createSelectFields(fields);
            const waves = await prisma.wave.findMany({
                select: selectField,
                where: {
                    status: 1
                }
            });
            //获取所有monster
            const monsters = await prisma.monster.findMany({
                select: { id: true, is_boss: true },
                where: {
                    status: 1
                }
            });
            if (_.isEmpty(monsters)) {
                return errorRes(res, "monster error");
            }
            const monstersObject = monsters.reduce((acc, monster) => {
                acc[monster.id] = monster.is_boss;
                return acc;
            }, {} as Record<number, boolean>);
            //判断是否有boss
            const formatWaves = waves.reduce((acc, wave) => {
                const tempData: string = wave.monster_id;
                const tempMon = tempData.split(";");
                const hasBoss = tempMon.some(monster => {
                    const tempMonID = Number(monster.split(',')[0]);
                    return monstersObject[tempMonID] === true;
                });
                // 将 wave 对象以 wave.id 为键加入到累加器中
                acc[wave.id] = {
                    ...wave,
                    is_boss: hasBoss ? 1 : 0 // 默认值为 0
                };
                return acc;
            }, {} as Record<number, object>);

            successRes(res, formatWaves);
        } catch (error) {
            errorRes(res, (error as Error).message);
        }
    },
];
