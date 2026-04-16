import { assertSyncConfig } from "./config-validation";
import { config } from "./config";
import { DatabaseService } from "./services/database.service";
import { SapService } from "./services/sap.service";
import { logger } from "./utils/logger";
import { mapSapFactProduccionRowsToSql } from "./utils/sap-fact-produccion-sql.mapper";
import type { SapRecord } from "./services/sap.service";
import { serializeError } from "./utils/serialize-error";

const FACT_PRODUCCION_TABLE = "fact_produccion";
const FACT_PRODUCCION_CONFLICT_KEYS = ["fact_produccion_id"];

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

const runSyncFactProduccion = async (): Promise<void> => {
  if (!config.enableSync) {
    logger.warn(
      { enabled: config.enableSync },
      "FACT_PRODUCCION deshabilitado por configuración (ENABLE_SYNC=false; flag compartido FACT/DIM)"
    );
    return;
  }

  try {
    assertSyncConfig();
  } catch (e) {
    logger.fatal(
      { err: serializeError(e) },
      "Configuración inválida; abortando sync fact_produccion"
    );
    process.exit(1);
  }

  const sapService = new SapService();
  const databaseService = new DatabaseService();
  const started = Date.now();
  const syncLogId = await databaseService.createSyncLog(
    FACT_PRODUCCION_TABLE,
    config.batchSize
  );
  let processed = 0;

  try {
    logger.info(
      {
        desde: config.syncFechaInicio,
        tabla: FACT_PRODUCCION_TABLE,
        conflictKeys: FACT_PRODUCCION_CONFLICT_KEYS
      },
      "Inicio sincronización FACT_PRODUCCION"
    );

    const records = await sapService.fetchFactProduccion(config.syncFechaInicio);
    if (records.length === 0) {
      logger.info("FACT_PRODUCCION: SAP no devolvió filas");
      return;
    }

    const rows = mapSapFactProduccionRowsToSql(records);
    if (rows.length === 0) {
      logger.warn(
        { sapRows: records.length },
        "FACT_PRODUCCION: no se pudo mapear ninguna fila"
      );
      return;
    }

    const dedupedRows = dedupeRowsByConflictKeys(
      rows,
      FACT_PRODUCCION_CONFLICT_KEYS
    );
    const duplicatedRows = rows.length - dedupedRows.length;
    if (duplicatedRows > 0) {
      logger.warn(
        { duplicatedRows, conflictKeys: FACT_PRODUCCION_CONFLICT_KEYS },
        "FACT_PRODUCCION: filas duplicadas detectadas en la corrida; se deduplican antes del upsert"
      );
    }

    const batches = chunkArray(dedupedRows, config.batchSize);
    logger.info(
      {
        totalRecords: dedupedRows.length,
        batchSize: config.batchSize,
        totalBatches: batches.length
      },
      "FACT_PRODUCCION: filas listas para upsert"
    );

    for (const [index, batch] of batches.entries()) {
      const count = await databaseService.bulkUpsert(
        FACT_PRODUCCION_TABLE,
        batch as unknown as SapRecord[],
        FACT_PRODUCCION_CONFLICT_KEYS
      );
      processed += count;

      logger.info(
        {
          batch: index + 1,
          totalBatches: batches.length,
          insertedOrUpdated: count,
          processed
        },
        "FACT_PRODUCCION: lote procesado"
      );
    }

    logger.info(
      {
        totalProcessed: processed,
        table: FACT_PRODUCCION_TABLE,
        durationMs: Date.now() - started
      },
      "FACT_PRODUCCION: sincronización finalizada"
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
      "FACT_PRODUCCION: error durante la sincronización"
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

void runSyncFactProduccion().finally(() => {
  process.exit(process.exitCode ?? 0);
});
