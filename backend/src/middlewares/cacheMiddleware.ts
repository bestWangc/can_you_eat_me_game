import { Request, Response, NextFunction } from "express";
import { successRes } from "../utils/responseHandler";
import Redis from "ioredis";
import _ from "lodash";

export const cacheMiddleware = (cacheKeyGenerator: (req: Request) => string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const cacheKey = cacheKeyGenerator(req);

		const redis = new Redis();

        const cachedData = await redis.get(cacheKey);

        if (cachedData) {
            return successRes(res, JSON.parse(cachedData));
        }
        const originalJson = res.json.bind(res);

        res.json = (body) => {
            if(!_.isEmpty(body.data)){
                redis.setex(cacheKey, 3600,JSON.stringify(body.data)).catch((err: any) => {
                    console.error("Failed to set cache:", err);
                });
            }
            return originalJson(body);
        };

        next();
    };
};