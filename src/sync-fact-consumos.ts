import { assertSyncConfig } from "./config-validation";
import { config } from "./config";
import { DatabaseService } from "./services/database.service";
import { SapService } from "./services/sap.service";
import { logger } from "./utils/logger";
import { mapSapFactConsumosRowsToSql } from "./utils/sap-fact-consumos-sql.mapper";
import type { SapRecord } from "./services/sap.service";
import { serializeError } from "./utils/serialize-error";

const FACT_CONSUMOS_TABLE = "fact_consumos";
const FACT_CONSUMOS_CONFLICT_KEYS = ["fact_consumo_id"];

const chunkArray = <T>(items: T[], batchSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    chunks.push(items.slice(i, i + batchSize));
  }
  return chunks;
};

const normalizeConflictValue = (value: unknown): string => {
  const raw = String(value ?? "");
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

const dedupeRowsByConflictKeys = (
  rows: Record<string, unknown>[],
  conflictKeys: string[]
): Record<string, unknown>[] => {
  const unique = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = conflictKeys.map((k) => normalizeConflictValue(row[k])).join("|");
    unique.set(key, row);
  }
  return Array.from(unique.values());
};

const runSyncFactConsumos = async (): Promise<void> => {
  if (!config.enableSync) {
    logger.warn(
      { enabled: config.enableSync },
      "FACT_CONSUMOS deshabilitado por configuración (ENABLE_SYNC=false; flag compartido FACT/DIM)"
    );
    return;
  }

  try {
    assertSyncConfig();
  } catch (e) {
    logger.fatal(
      { err: serializeError(e) },
      "Configuración inválida; abortando sync fact_consumos"
    );
    process.exit(1);
  }

  const sapService = new SapService();
  const databaseService = new DatabaseService();
  const started = Date.now();
  const syncLogId = await databaseService.createSyncLog(
    FACT_CONSUMOS_TABLE,
    config.batchSize
  );
  let processed = 0;

  try {
    logger.info(
      {
        tabla: FACT_CONSUMOS_TABLE,
        conflictKeys: FACT_CONSUMOS_CONFLICT_KEYS
      },
      "Inicio sincronización FACT_CONSUMOS"
    );

    const records = await sapService.fetchFactConsumos();
    if (records.length === 0) {
      logger.info("FACT_CONSUMOS: SAP no devolvió filas");
      return;
    }

    const rows = mapSapFactConsumosRowsToSql(records);
    if (rows.length === 0) {
      logger.warn(
        { sapRows: records.length },
        "FACT_CONSUMOS: no se pudo mapear ninguna fila"
      );
      return;
    }

    const dedupedRows = dedupeRowsByConflictKeys(rows, FACT_CONSUMOS_CONFLICT_KEYS);
    const duplicatedRows = rows.length - dedupedRows.length;
    if (duplicatedRows > 0) {
      logger.warn(
        { duplicatedRows, conflictKeys: FACT_CONSUMOS_CONFLICT_KEYS },
        "FACT_CONSUMOS: filas duplicadas detectadas en la corrida; se deduplican antes del upsert"
      );
    }

    const batches = chunkArray(dedupedRows, config.batchSize);
    logger.info(
      {
        totalRecords: dedupedRows.length,
        batchSize: config.batchSize,
        totalBatches: batches.length
      },
      "FACT_CONSUMOS: filas listas para upsert"
    );

    for (const [index, batch] of batches.entries()) {
      const count = await databaseService.bulkUpsert(
        FACT_CONSUMOS_TABLE,
        batch as unknown as SapRecord[],
        FACT_CONSUMOS_CONFLICT_KEYS
      );
      processed += count;

      logger.info(
        {
          batch: index + 1,
          totalBatches: batches.length,
          insertedOrUpdated: count,
          processed
        },
        "FACT_CONSUMOS: lote procesado"
      );
    }

    logger.info(
      {
        totalProcessed: processed,
        table: FACT_CONSUMOS_TABLE,
        durationMs: Date.now() - started
      },
      "FACT_CONSUMOS: sincronización finalizada"
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
      "FACT_CONSUMOS: error durante la sincronización"
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

void runSyncFactConsumos().finally(() => {
  process.exit(process.exitCode ?? 0);
});
