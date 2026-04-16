import { assertSyncConfig } from "./config-validation";
import { config } from "./config";
import { DatabaseService } from "./services/database.service";
import { SapService } from "./services/sap.service";
import { logger } from "./utils/logger";
import { mapSapEficienciaRowsToSql } from "./utils/sap-eficiencia-sql.mapper";
import type { SapRecord } from "./services/sap.service";
import { serializeError } from "./utils/serialize-error";

const EFICIENCIA_TABLE = "kpi_prod_eficiencia";
const EFICIENCIA_CONFLICT_KEYS = ["kpi_eficiencia_id"];

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

const runSyncEficiencia = async (): Promise<void> => {
  try {
    assertSyncConfig();
  } catch (e) {
    logger.fatal(
      { err: serializeError(e) },
      "Configuración inválida; abortando sync eficiencia"
    );
    process.exit(1);
  }

  const sapService = new SapService();
  const databaseService = new DatabaseService();
  const started = Date.now();
  const syncLogId = await databaseService.createSyncLog(
    EFICIENCIA_TABLE,
    config.syncEficienciaBatchSize
  );
  let processed = 0;

  try {
    logger.info(
      {
        desde: config.syncFechaInicio,
        tabla: EFICIENCIA_TABLE,
        conflictKeys: EFICIENCIA_CONFLICT_KEYS
      },
      "Inicio sincronización KPI_PROD_EFICIENCIA"
    );

    const records = await sapService.fetchKpiProdEficiencia(config.syncFechaInicio);
    if (records.length === 0) {
      logger.info("KPI_PROD_EFICIENCIA: SAP no devolvió filas");
      return;
    }

    const rows = mapSapEficienciaRowsToSql(records);
    if (rows.length === 0) {
      logger.warn(
        { sapRows: records.length },
        "KPI_PROD_EFICIENCIA: no se pudo mapear ninguna fila"
      );
      return;
    }

    const dedupedRows = dedupeRowsByConflictKeys(rows, EFICIENCIA_CONFLICT_KEYS);
    const duplicatedRows = rows.length - dedupedRows.length;
    if (duplicatedRows > 0) {
      logger.warn(
        { duplicatedRows, conflictKeys: EFICIENCIA_CONFLICT_KEYS },
        "KPI_PROD_EFICIENCIA: filas duplicadas detectadas en la corrida; se deduplican antes del upsert"
      );
    }

    const batches = chunkArray(dedupedRows, config.syncEficienciaBatchSize);
    logger.info(
      {
        totalRecords: dedupedRows.length,
        batchSize: config.syncEficienciaBatchSize,
        totalBatches: batches.length
      },
      "KPI_PROD_EFICIENCIA: filas listas para upsert"
    );

    for (const [index, batch] of batches.entries()) {
      const count = await databaseService.bulkUpsert(
        EFICIENCIA_TABLE,
        batch as unknown as SapRecord[],
        EFICIENCIA_CONFLICT_KEYS
      );
      processed += count;

      logger.info(
        {
          batch: index + 1,
          totalBatches: batches.length,
          insertedOrUpdated: count,
          processed
        },
        "KPI_PROD_EFICIENCIA: lote procesado"
      );
    }

    logger.info(
      {
        totalProcessed: processed,
        table: EFICIENCIA_TABLE,
        durationMs: Date.now() - started
      },
      "KPI_PROD_EFICIENCIA: sincronización finalizada"
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
      "KPI_PROD_EFICIENCIA: error durante la sincronización"
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

void runSyncEficiencia().finally(() => {
  process.exit(process.exitCode ?? 0);
});
