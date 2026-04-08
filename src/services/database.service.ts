import knex, { Knex } from "knex";
import { config } from "../config";
import { logger } from "../utils/logger";
import { SapRecord } from "./sap.service";

export class DatabaseService {
  private readonly db: Knex;

  constructor() {
    const baseConnection = {
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database
    };

    const connection =
      config.db.client === "mssql"
        ? {
            ...baseConnection,
            options: {
              encrypt: config.db.encrypt,
              trustServerCertificate: config.db.trustServerCertificate
            }
          }
        : {
            ...baseConnection,
            ssl: config.db.ssl
          };

    this.db = knex({
      client: config.db.client,
      connection,
      pool: {
        min: config.db.poolMin,
        max: config.db.poolMax
      }
    });
  }

  public async bulkUpsert(
    tableName: string,
    rows: SapRecord[],
    conflictKeys: string[]
  ): Promise<number> {
    if (rows.length === 0) return 0;

    try {
      await this.db(tableName).insert(rows).onConflict(conflictKeys).merge();
      return rows.length;
    } catch (error) {
      logger.error(
        { error, tableName, conflictKeys, rows: rows.length },
        "Error al ejecutar bulk upsert"
      );
      throw error;
    }
  }

  public async findProductionOrdersByMonth(
    tableName: string,
    dateColumn: string,
    startDate: Date,
    endDate: Date
  ): Promise<SapRecord[]> {
    try {
      const rows = await this.db(tableName)
        .where(dateColumn, ">=", startDate)
        .andWhere(dateColumn, "<", endDate)
        .orderBy(dateColumn, "asc");

      return rows as SapRecord[];
    } catch (error) {
      logger.error(
        { error, tableName, dateColumn, startDate, endDate },
        "Error consultando ordenes de produccion por mes"
      );
      throw error;
    }
  }

  public async close(): Promise<void> {
    await this.db.destroy();
    logger.info("Conexión de base de datos cerrada");
  }
}
