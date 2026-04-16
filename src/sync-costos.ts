import { assertSyncConfig } from "./config-validation";
import { config } from "./config";
import { DatabaseService } from "./services/database.service";
import { SapService } from "./services/sap.service";
import { logger } from "./utils/logger";
import { mapSapCostosRowsToSql } from "./utils/sap-costos-sql.mapper";
import type { SapRecord } from "./services/sap.service";
import { serializeError } from "./utils/serialize-error";

const COSTOS_TABLE = "kpi_prod_costos";
const COSTOS_CONFLICT_KEYS = ["kpi_costos_id"];

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
    unique.set(key, row);
  }
  return Array.from(unique.values());
};

const runSyncCostos = async (): Promise<void> => {
  try {
    assertSyncConfig();
  } catch (e) {
    logger.fatal(
      { err: serializeError(e) },
      "Configuración inválida; abortando sync costos"
    );
    process.exit(1);
  }

  const sapService = new SapService();
  const databaseService = new DatabaseService();
  const started = Date.now();
  const syncLogId = await databaseService.createSyncLog(
    COSTOS_TABLE,
    config.syncCostosBatchSize
  );
  let processed = 0;

  try {
    logger.info(
      {
        desde: config.syncFechaInicio,
        tabla: COSTOS_TABLE,
        conflictKeys: COSTOS_CONFLICT_KEYS
      },
      "Inicio sincronización KPI_PROD_COSTOS"
    );

    const records = await sapService.fetchKpiProdCostos(config.syncFechaInicio);
    if (records.length === 0) {
      logger.info("KPI_PROD_COSTOS: SAP no devolvió filas");
      return;
    }

    const rows = mapSapCostosRowsToSql(records);
    if (rows.length === 0) {
      logger.warn(
        { sapRows: records.length },
        "KPI_PROD_COSTOS: no se pudo mapear ninguna fila"
      );
      return;
    }

    const dedupedRows = dedupeRowsByConflictKeys(rows, COSTOS_CONFLICT_KEYS);
    const duplicatedRows = rows.length - dedupedRows.length;
    if (duplicatedRows > 0) {
      logger.warn(
        { duplicatedRows, conflictKeys: COSTOS_CONFLICT_KEYS },
        "KPI_PROD_COSTOS: filas duplicadas detectadas en la corrida; se deduplican antes del upsert"
      );
    }

    const batches = chunkArray(dedupedRows, config.syncCostosBatchSize);
    logger.info(
      {
        totalRecords: dedupedRows.length,
        batchSize: config.syncCostosBatchSize,
        totalBatches: batches.length
      },
      "KPI_PROD_COSTOS: filas listas para upsert"
    );

    for (const [index, batch] of batches.entries()) {
      const count = await databaseService.bulkUpsert(
        COSTOS_TABLE,
        batch as unknown as SapRecord[],
        COSTOS_CONFLICT_KEYS
      );
      processed += count;

      logger.info(
        {
          batch: index + 1,
          totalBatches: batches.length,
          insertedOrUpdated: count,
          processed
        },
        "KPI_PROD_COSTOS: lote procesado"
      );
    }

    logger.info(
      {
        totalProcessed: processed,
        table: COSTOS_TABLE,
        durationMs: Date.now() - started
      },
      "KPI_PROD_COSTOS: sincronización finalizada"
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
      "KPI_PROD_COSTOS: error durante la sincronización"
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

void runSyncCostos().finally(() => {
  process.exit(process.exitCode ?? 0);
});
