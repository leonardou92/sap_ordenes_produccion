import knex, { Knex } from "knex";
import { config } from "../config";
import { logger } from "../utils/logger";
import { serializeError } from "../utils/serialize-error";
import { SapRecord } from "./sap.service";

const assertSafeSqlIdentifier = (name: string, label: string): void => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`${label} inválido para SQL Server: ${name}`);
  }
};

export class DatabaseService {
  private readonly db: Knex;
  private static readonly SYNC_LOG_ERROR_MAX_LENGTH = 1000;

  private static compactSqlErrorMessage(errorMessage: string): string {
    const normalized = errorMessage.replace(/\s+/g, " ").trim();
    // Knex/mssql suele devolver "<SQL enorme> - <causa real>"; nos quedamos con la causa.
    const separator = " - ";
    const idx = normalized.lastIndexOf(separator);
    if (idx === -1) return normalized;
    const cause = normalized.slice(idx + separator.length).trim();
    return cause || normalized;
  }

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
      if (config.db.client === "mssql") {
        return await this.bulkUpsertMssql(
          tableName,
          rows as Record<string, unknown>[],
          conflictKeys
        );
      }

      await this.db(tableName).insert(rows).onConflict(conflictKeys).merge();
      return rows.length;
    } catch (error) {
      logger.error(
        {
          err: {
            ...serializeError(error),
            message: DatabaseService.compactSqlErrorMessage(
              serializeError(error).message
            )
          },
          tableName,
          conflictKeys,
          rows: rows.length
        },
        "Error al ejecutar bulk upsert"
      );
      throw error;
    }
  }

  public async createSyncLog(
    targetTable: string,
    batchSize: number
  ): Promise<number | null> {
    try {
      const row = {
        source: "SAP",
        targetTable,
        batchSize,
        totalProcessed: 0,
        status: "running",
        startedAt: new Date()
      };

      if (config.db.client === "mssql") {
        const result = await this.db("sync_logs")
          .insert(row, ["id"])
          .catch(async () => {
            const raw = await this.db.raw(`
              INSERT INTO [sync_logs] ([source], [targetTable], [batchSize], [totalProcessed], [status], [startedAt])
              OUTPUT INSERTED.[id]
              VALUES (N'SAP', N'${targetTable.replace(/'/g, "''")}', ${batchSize}, 0, N'running', SYSDATETIME());
            `);
            const fromRaw = (raw as any)?.recordset?.[0]?.id;
            return fromRaw ? [{ id: fromRaw }] : [];
          });
        const inserted = Array.isArray(result)
          ? result[0]
          : (result as unknown as { id?: number }[])[0];
        return inserted?.id ?? null;
      }

      const result = await this.db("sync_logs").insert(row, ["id"]);
      return (result[0] as { id?: number })?.id ?? null;
    } catch (error) {
      logger.warn(
        { err: serializeError(error), targetTable, batchSize },
        "No se pudo crear registro en sync_logs"
      );
      return null;
    }
  }

  public async finishSyncLog(
    id: number | null,
    status: "success" | "error",
    totalProcessed: number,
    errorMessage?: string
  ): Promise<void> {
    if (!id) return;
    try {
      const normalizedErrorMessage = (() => {
        if (!errorMessage) return null;
        const value = DatabaseService.compactSqlErrorMessage(errorMessage);
        if (value.length <= DatabaseService.SYNC_LOG_ERROR_MAX_LENGTH) {
          return value;
        }
        // Conserva inicio y final para no perder la causa al final del mensaje.
        const marker = " … [truncado] … ";
        const available =
          DatabaseService.SYNC_LOG_ERROR_MAX_LENGTH - marker.length;
        const head = Math.floor(available * 0.55);
        const tail = available - head;
        return `${value.slice(0, head)}${marker}${value.slice(-tail)}`;
      })();

      await this.db("sync_logs")
        .where({ id })
        .update({
          status,
          totalProcessed,
          errorMessage: normalizedErrorMessage,
          finishedAt: new Date()
        });
    } catch (error) {
      logger.warn(
        {
          err: serializeError(error),
          id,
          status,
          totalProcessed
        },
        "No se pudo actualizar registro en sync_logs"
      );
    }
  }

  /** Knex no implementa onConflict/merge en MSSQL; se usa MERGE nativo. */
  private escapeMssqlScalar(value: unknown): string {
    if (value === null || value === undefined) {
      return "NULL";
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    if (typeof value === "boolean") {
      return value ? "1" : "0";
    }
    if (value instanceof Date) {
      const iso = value.toISOString().replace("T", " ").replace("Z", "");
      return `CAST(N'${iso}' AS DATETIME2(3))`;
    }
    if (typeof value === "string") {
      return `N'${value.replace(/'/g, "''")}'`;
    }
    return `N'${String(value).replace(/'/g, "''")}'`;
  }

  private async bulkUpsertMssql(
    tableName: string,
    rows: Record<string, unknown>[],
    conflictKeys: string[]
  ): Promise<number> {
    assertSafeSqlIdentifier(tableName, "tabla");
    const columns = Object.keys(rows[0]);
    for (const c of columns) {
      assertSafeSqlIdentifier(c, "columna");
    }
    for (const k of conflictKeys) {
      assertSafeSqlIdentifier(k, "conflictKey");
      if (!columns.includes(k)) {
        throw new Error(`conflictKey ${k} no está en las filas`);
      }
    }

    const bracket = (id: string): string => `[${id}]`;
    const updateCols = columns.filter((c) => !conflictKeys.includes(c));
    if (updateCols.length === 0) {
      throw new Error("No hay columnas para UPDATE en bulk upsert");
    }

    const valueTuples = rows.map(
      (row) =>
        `(${columns.map((c) => this.escapeMssqlScalar(row[c])).join(", ")})`
    );

    const colList = columns.map(bracket).join(", ");
    const onClause = conflictKeys
      .map((k) => `target.${bracket(k)} = source.${bracket(k)}`)
      .join(" AND ");
    const updateSet = updateCols
      .map((c) => `target.${bracket(c)} = source.${bracket(c)}`)
      .join(", ");
    const insertCols = columns.map(bracket).join(", ");
    const insertVals = columns.map((c) => `source.${bracket(c)}`).join(", ");

    const sql = `
MERGE ${bracket(tableName)} WITH (HOLDLOCK) AS target
USING (
  VALUES
    ${valueTuples.join(",\n    ")}
) AS source (${colList})
ON ${onClause}
WHEN MATCHED THEN UPDATE SET ${updateSet}
WHEN NOT MATCHED BY TARGET THEN INSERT (${insertCols}) VALUES (${insertVals});
`;

    await this.db.raw(sql);
    return rows.length;
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
        {
          err: serializeError(error),
          tableName,
          dateColumn,
          startDate,
          endDate
        },
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
