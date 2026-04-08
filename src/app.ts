import express from "express";
import helmet from "helmet";
import { config } from "./config";
import { errorHandlerMiddleware } from "./middleware/error-handler";
import { requestIdMiddleware } from "./middleware/request-id";
import healthRoutes from "./routes/health.routes";
import ordenesProduccionRoutes from "./routes/ordenes-produccion.routes";

const app = express();

app.set("trust proxy", config.trustProxy);

app.use(requestIdMiddleware);
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(express.json({ limit: "256kb" }));

const apiMountPath = config.apiBasePath
  ? `${config.apiBasePath}/api`
  : "/api";

app.use(apiMountPath, healthRoutes);
if (config.enableOrdenesConsultaApi) {
  app.use(apiMountPath, ordenesProduccionRoutes);
}

app.use(errorHandlerMiddleware);

export default app;
