import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload, VerifyErrors } from "jsonwebtoken";
import { usersToken } from "../models/models";

// const JWT_SECRET = "tg.game-jwt-token-secret";
const JWT_SECRET: string = process.env.JWT_SECRET_KEY as string;

declare global {
  namespace Express {
    interface Request {
      user?: usersToken | null;
    }
  }
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ code: 401, msg: "Unauthorized" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ code: 403, msg: "someting error" });
    }
    req.user = decoded as usersToken;
    next();
  });
};

export const authenticateNotNecessary = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      req.user = null;
    } else {
      req.user = decoded as usersToken;
    }
    next();
  });
};
