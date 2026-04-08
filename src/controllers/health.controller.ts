import type { Request, Response } from "express";
import knex from "knex";
import { config } from "../config";
import { logger } from "../utils/logger";
import { serializeError } from "../utils/serialize-error";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require("../../package.json") as { name: string; version: string };

/** Liveness: sin dependencias externas. */
export const getHealth = (req: Request, res: Response): void => {
  res.status(200).json({
    ok: true,
    service: pkg.name,
    version: pkg.version,
    requestId: req.requestId
  });
};

/**
 * Readiness: comprueba SQL Server (misma config que el sync).
 * Uso detrás de balanceadores / orquestadores.
 */
export const getHealthReady = async (
  req: Request,
  res: Response
): Promise<void> => {
  const db = knex({
    client: config.db.client,
    connection:
      config.db.client === "mssql"
        ? {
            host: config.db.host,
            port: config.db.port,
            user: config.db.user,
            password: config.db.password,
            database: config.db.database,
            options: {
              encrypt: config.db.encrypt,
              trustServerCertificate: config.db.trustServerCertificate
            }
          }
        : {
            host: config.db.host,
            port: config.db.port,
            user: config.db.user,
            password: config.db.password,
            database: config.db.database,
            ssl: config.db.ssl
          },
    pool: { min: 0, max: 1 }
  });

  try {
    if (config.db.client === "mssql") {
      await db.raw("SELECT 1 AS ok");
    } else {
      await db.raw("SELECT 1");
    }
    res.status(200).json({
      ok: true,
      database: "reachable",
      requestId: req.requestId
    });
  } catch (e) {
    logger.warn({ err: serializeError(e), requestId: req.requestId }, "Health ready: DB no accesible");
    res.status(503).json({
      ok: false,
      database: "unreachable",
      requestId: req.requestId
    });
  } finally {
    await db.destroy();
  }
};
