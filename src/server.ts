import app from "./app";
import { assertApiConfig } from "./config-validation";
import { config } from "./config";
import { logger } from "./utils/logger";
import { serializeError } from "./utils/serialize-error";

try {
  assertApiConfig();
} catch (e) {
  logger.fatal({ err: serializeError(e) }, "Configuración inválida; no se inicia la API");
  process.exit(1);
}

const server = app.listen(config.port, config.listenHost, () => {
  const base = config.apiBasePath || "";
  logger.info(
    {
      port: config.port,
      listenHost: config.listenHost,
      trustProxy: config.trustProxy,
      apiBasePath: config.apiBasePath || "(raíz)",
      ordenesConsultaApi: config.enableOrdenesConsultaApi,
      ejemploRuta: config.enableOrdenesConsultaApi
        ? `${base}/api/ordenes-produccion`
        : "(deshabilitado; ENABLE_ORDENES_CONSULTA_API)",
      health: `${base}/api/health`,
      ready: `${base}/api/health/ready`
    },
    "API iniciada"
  );
});

const SHUTDOWN_MS = 10_000;

function shutdown(signal: string): void {
  logger.info({ signal }, "Señal de apagado recibida; cerrando HTTP");
  server.close((err) => {
    if (err) {
      logger.error({ err: serializeError(err) }, "Error al cerrar el servidor HTTP");
      process.exit(1);
    }
    logger.info("Servidor HTTP cerrado correctamente");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Tiempo de gracia agotado; saliendo con código 1");
    process.exit(1);
  }, SHUTDOWN_MS).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
