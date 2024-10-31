import express from "express";
import {
  getDiscountShops,
  buyFruitFragment,
  // refreshDiscountShop,
  openBox,
  getFreeGold,
  getFreeDiamonds,
} from "../controllers/shopController";
import {
  authenticate,
  authenticateNotNecessary,
} from "../middlewares/authenticate";

const router = express.Router();

router.get("/todayShop", getDiscountShops);
router.post("/buyFruitFragment",authenticate, buyFruitFragment);
// router.post("/refreshDiscountShop", refreshDiscountShop);
router.post("/openBox",authenticate, openBox);
router.post("/getFreeGold", authenticate, getFreeGold);
router.post("/getFreeDiamonds", authenticate, getFreeDiamonds);

export { router as shopRouter };
