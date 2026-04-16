import { assertSyncConfig } from "./config-validation";
import { config } from "./config";
import { DatabaseService } from "./services/database.service";
import { SapService } from "./services/sap.service";
import { logger } from "./utils/logger";
import { mapSapLogisticaRowsToSql } from "./utils/sap-logistica-sql.mapper";
import type { SapRecord } from "./services/sap.service";
import { serializeError } from "./utils/serialize-error";

const LOGISTICA_TABLE = "kpi_prod_logistica";
const LOGISTICA_CONFLICT_KEYS = ["orden"];

const chunkArray = <T>(items: T[], batchSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    chunks.push(items.slice(i, i + batchSize));
  }
  return chunks;
};

const dedupeRowsByConflictKeys = (
  rows: Record<string, unknown>[],
  conflictKeys: string[]
): Record<string, unknown>[] => {
  const unique = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = conflictKeys.map((k) => String(row[k] ?? "")).join("|");
    // Última ocurrencia gana, evitando colisiones de MERGE por claves repetidas.
    unique.set(key, row);
  }
  return Array.from(unique.values());
};

const runSyncLogistica = async (): Promise<void> => {
  try {
    assertSyncConfig();
  } catch (e) {
    logger.fatal(
      { err: serializeError(e) },
      "Configuración inválida; abortando sync logística"
    );
    process.exit(1);
  }

  const sapService = new SapService();
  const databaseService = new DatabaseService();
  const started = Date.now();
  const syncLogId = await databaseService.createSyncLog(
    LOGISTICA_TABLE,
    config.syncLogisticaBatchSize
  );
  let processed = 0;

  try {
    logger.info(
      {
        desde: config.syncFechaInicio,
        tabla: LOGISTICA_TABLE,
        conflictKeys: LOGISTICA_CONFLICT_KEYS
      },
      "Inicio sincronización KPI_PROD_LOGISTICA"
    );

    const records = await sapService.fetchKpiProdLogistica(
      config.syncFechaInicio
    );
    if (records.length === 0) {
      logger.info("KPI_PROD_LOGISTICA: SAP no devolvió filas");
      return;
    }

    const rows = mapSapLogisticaRowsToSql(records);
    if (rows.length === 0) {
      logger.warn(
        { sapRows: records.length },
        "KPI_PROD_LOGISTICA: no se pudo mapear ninguna fila"
      );
      return;
    }

    const dedupedRows = dedupeRowsByConflictKeys(
      rows,
      LOGISTICA_CONFLICT_KEYS
    );
    const duplicatedRows = rows.length - dedupedRows.length;
    if (duplicatedRows > 0) {
      logger.warn(
        { duplicatedRows, conflictKeys: LOGISTICA_CONFLICT_KEYS },
        "KPI_PROD_LOGISTICA: filas duplicadas detectadas en la corrida; se deduplican antes del upsert"
      );
    }

    const batches = chunkArray(dedupedRows, config.syncLogisticaBatchSize);
    logger.info(
      {
        totalRecords: dedupedRows.length,
        batchSize: config.syncLogisticaBatchSize,
        totalBatches: batches.length
      },
      "KPI_PROD_LOGISTICA: filas listas para upsert"
    );

    for (const [index, batch] of batches.entries()) {
      const count = await databaseService.bulkUpsert(
        LOGISTICA_TABLE,
        batch as unknown as SapRecord[],
        LOGISTICA_CONFLICT_KEYS
      );
      processed += count;

      logger.info(
        {
          batch: index + 1,
          totalBatches: batches.length,
          insertedOrUpdated: count,
          processed
        },
        "KPI_PROD_LOGISTICA: lote procesado"
      );
    }

    logger.info(
      {
        totalProcessed: processed,
        table: LOGISTICA_TABLE,
        durationMs: Date.now() - started
      },
      "KPI_PROD_LOGISTICA: sincronización finalizada"
    );
  } catch (error) {
    await databaseService.finishSyncLog(
      syncLogId,
      "error",
      processed,
      error instanceof Error ? error.message : String(error)
    );
    logger.error(
      { err: serializeError(error) },
      "KPI_PROD_LOGISTICA: error durante la sincronización"
    );
    process.exitCode = 1;
  } finally {
    if (process.exitCode !== 1) {
      await databaseService.finishSyncLog(syncLogId, "success", processed);
    }
    try {
      await databaseService.close();
    } catch (closeError) {
      logger.error(
        { err: serializeError(closeError) },
        "Error cerrando conexión de base de datos"
      );
      process.exitCode = 1;
    }
  }
};

void runSyncLogistica().finally(() => {
  process.exit(process.exitCode ?? 0);
});
