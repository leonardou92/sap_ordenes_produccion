import pino from "pino";
import { config } from "../config";

export const logger = pino({
  level: config.logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: "sap-sql-sync",
    env: config.nodeEnv
  }
});
