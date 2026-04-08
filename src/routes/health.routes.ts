import { Router } from "express";
import { getHealth, getHealthReady } from "../controllers/health.controller";

const router = Router();

router.get("/health", getHealth);
router.get("/health/ready", (req, res, next) => {
  void getHealthReady(req, res).catch(next);
});

export default router;
