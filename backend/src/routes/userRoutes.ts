import { Router } from "express";
import {
  getUserInfo,
  generateInviteCode,
  useInviteCode,
  getReferrals,
  getUserToken,
  refreshUserToken,
} from "../controllers/userController";
import {
  authenticate,
} from "../middlewares/authenticate";

const router = Router();

router.post("/userInfo", authenticate, getUserInfo);
// router.get("/", getAllUsers);
router.post("/token", getUserToken);
router.post("/refreshToken", authenticate, refreshUserToken);

export { router as userRouter };
