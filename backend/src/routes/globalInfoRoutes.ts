import { Router } from "express";
import {
    getAllBuffs,
    getAllConfigs,
    getAllFruits,
    getAllFruitLevelUps,
    getAllLevels,
    getAllMonsters,
    getAllTalents,
    getAllWaves,
} from "../controllers/globalInfoController";

const router = Router();

router.get("/buffs", getAllBuffs);
router.get("/configs", getAllConfigs);
router.get("/fruits", getAllFruits);
router.get("/fruit-level-ups", getAllFruitLevelUps);
router.get("/levels", getAllLevels);
router.get("/monsters", getAllMonsters);
router.get("/talents", getAllTalents);
router.get("/waves", getAllWaves);

export default router;