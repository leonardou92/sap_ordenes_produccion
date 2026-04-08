import { Router } from "express";
import { getOrdenesProduccionPorRango } from "../controllers/ordenes-produccion.controller";

const router = Router();

router.get("/ordenes-produccion", getOrdenesProduccionPorRango);

export default router;
