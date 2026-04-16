import { assertSyncConfig } from "./config-validation";
import { config } from "./config";
import { DatabaseService } from "./services/database.service";
import { SapService } from "./services/sap.service";
import { logger } from "./utils/logger";
import { mapSapDimOrdenesRowsToSql } from "./utils/sap-dim-ordenes-sql.mapper";
import type { SapRecord } from "./services/sap.service";
import { serializeError } from "./utils/serialize-error";

const DIM_ORDENES_TABLE = "dim_ordenes";
const DIM_ORDENES_CONFLICT_KEYS = ["orden_id"];

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

const runSyncDimOrdenes = async (): Promise<void> => {
  if (!config.enableSync) {
    logger.warn(
      { enabled: config.enableSync },
      "DIM_ORDENES deshabilitado por configuración (ENABLE_SYNC=false; flag compartido FACT/DIM)"
    );
    return;
  }

  try {
    assertSyncConfig();
  } catch (e) {
    logger.fatal(
      { err: serializeError(e) },
      "Configuración inválida; abortando sync dim_ordenes"
    );
    process.exit(1);
  }

  const sapService = new SapService();
  const databaseService = new DatabaseService();
  const started = Date.now();
  const syncLogId = await databaseService.createSyncLog(
    DIM_ORDENES_TABLE,
    config.batchSize
  );
  let processed = 0;

  try {
    logger.info(
      {
        desde: config.syncFechaInicio,
        tabla: DIM_ORDENES_TABLE,
        conflictKeys: DIM_ORDENES_CONFLICT_KEYS
      },
      "Inicio sincronización DIM_ORDENES"
    );

    const records = await sapService.fetchDimOrdenes(config.syncFechaInicio);
    if (records.length === 0) {
      logger.info("DIM_ORDENES: SAP no devolvió filas");
      return;
    }

    const rows = mapSapDimOrdenesRowsToSql(records);
    if (rows.length === 0) {
      logger.warn(
        { sapRows: records.length },
        "DIM_ORDENES: no se pudo mapear ninguna fila"
      );
      return;
    }

    const dedupedRows = dedupeRowsByConflictKeys(rows, DIM_ORDENES_CONFLICT_KEYS);
    const duplicatedRows = rows.length - dedupedRows.length;
    if (duplicatedRows > 0) {
      logger.warn(
        { duplicatedRows, conflictKeys: DIM_ORDENES_CONFLICT_KEYS },
        "DIM_ORDENES: filas duplicadas detectadas en la corrida; se deduplican antes del upsert"
      );
    }

    const batches = chunkArray(dedupedRows, config.batchSize);
    logger.info(
      {
        totalRecords: dedupedRows.length,
        batchSize: config.batchSize,
        totalBatches: batches.length
      },
      "DIM_ORDENES: filas listas para upsert"
    );

    for (const [index, batch] of batches.entries()) {
      const count = await databaseService.bulkUpsert(
        DIM_ORDENES_TABLE,
        batch as unknown as SapRecord[],
        DIM_ORDENES_CONFLICT_KEYS
      );
      processed += count;

      logger.info(
        {
          batch: index + 1,
          totalBatches: batches.length,
          insertedOrUpdated: count,
          processed
        },
        "DIM_ORDENES: lote procesado"
      );
    }

    logger.info(
      {
        totalProcessed: processed,
        table: DIM_ORDENES_TABLE,
        durationMs: Date.now() - started
      },
      "DIM_ORDENES: sincronización finalizada"
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
      "DIM_ORDENES: error durante la sincronización"
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

void runSyncDimOrdenes().finally(() => {
  process.exit(process.exitCode ?? 0);
});
