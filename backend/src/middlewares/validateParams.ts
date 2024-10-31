// import { Request, Response, NextFunction } from 'express';
// import { PrismaClient } from '@prisma/client';
// import { errorRes } from '../utils/responseHandler';

// const prisma = new PrismaClient();

// export const validateUser = async (req: Request, res: Response, next: NextFunction) => {
//   const { telegram_id } = req.params;
//   const user = await prisma.users.findUnique({ where: { telegram_id } });

//   if (!user) {
//     return errorRes(res, 'User not found');
//   }

//   next();};
