import express from "express";
import {
  getBag,
  getFruitDetails,
  upgradeFruit,
} from "../controllers/bagController";
import { authenticate } from "../middlewares/authenticate";

const router = express.Router();

router.post("/getBag", authenticate, getBag);

//no use
// router.get("/fruitDetails",authenticate, getFruitDetails);

router.post("/upgradeFruit",authenticate, upgradeFruit);

export { router as bagRouter };
