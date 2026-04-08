import express from "express";
import { config } from "./config";
import ordenesProduccionRoutes from "./routes/ordenes-produccion.routes";

const app = express();

app.use(express.json());

const apiMountPath = config.apiBasePath
  ? `${config.apiBasePath}/api`
  : "/api";

app.use(apiMountPath, ordenesProduccionRoutes);

export default app;
