import express from "express";
import {
  dailySignIn,
  winLevelReward,
  getUserFightObtainBox,
  openLevelRewardBox,
  recordFightLog,
  refreshTalent,
  startGame,
  costToken,
} from "../controllers/fightController";
import {
  authenticate,
  authenticateNotNecessary,
} from "../middlewares/authenticate";

const router = express.Router();

router.post("/daySignIn", authenticate, dailySignIn);
router.post("/game/startGame", authenticate, startGame);
router.post("/game/winReward",authenticate, winLevelReward);
router.post("/game_levels/getObtainBox", authenticate, getUserFightObtainBox);
router.post("/game_levels/rewardBox", authenticate, openLevelRewardBox);
router.post("/game/recordFightLog",authenticate, recordFightLog);
router.post("/costToken", authenticate, costToken);

//前端刷新天赋 这接口应该不需要了
// router.post("/refreshTalent", refreshTalent);

export { router as fightRouter };
