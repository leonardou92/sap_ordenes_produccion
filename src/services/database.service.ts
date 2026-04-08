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
          err: serializeError(error),
          tableName,
          conflictKeys,
          rows: rows.length
        },
        "Error al ejecutar bulk upsert"
      );
      throw error;
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
