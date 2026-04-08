import app from "./app";
import { config } from "./config";
import { logger } from "./utils/logger";

app.listen(config.port, () => {
  const base = config.apiBasePath || "";
  const ejemplo = `${base}/api/ordenes-produccion`;
  logger.info(
    { port: config.port, apiBasePath: config.apiBasePath || "(raíz)", ejemploRuta: ejemplo },
    "API iniciada"
  );
});
