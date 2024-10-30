import express from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { userRouter } from "./routes/userRoutes";
import { shopRouter } from "./routes/shopRoutes";
import { bagRouter } from "./routes/bagRouter";
import { fightRouter } from "./routes/fightRouter";
import globalInfoRoutes from "./routes/globalInfoRoutes";

const app = express();

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 1000,
  handler: (req, res, next) => {
    res.status(429).json({ code:429, msg: 'Too many requests. Please try again later.' });
  }
});

// 允许所有源的 CORS 配置
app.use(cors());
// 处理所有 OPTIONS 请求
app.options('*', cors()); // 允许所有 OPTIONS 请求

app.use(limiter);

app.use(express.json());

app.all("/", (req, res) => {
  res.send("Hello eat me!");
});

app.use("/api/user", userRouter);
app.use("/api/shop", shopRouter);
app.use("/api/bag", bagRouter);
app.use("/api/fight", fightRouter);
app.use("/api/global-info", globalInfoRoutes);

export default app;
