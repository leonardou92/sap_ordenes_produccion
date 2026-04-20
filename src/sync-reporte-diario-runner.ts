import { assertSyncConfig } from "./config-validation";
import { config } from "./config";
import { DatabaseService } from "./services/database.service";
import { SapService } from "./services/sap.service";
import type { SapRecord } from "./services/sap.service";
import { logger } from "./utils/logger";
import { serializeError } from "./utils/serialize-error";

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

export type ReporteDiarioSyncOptions = {
  /** Tabla física en SQL Server (MERGE). */
  tableName: string;
  /**
   * Valor en `sync_logs.targetTable` (p. ej. `PB_reporte_resumen`).
   * Por defecto = `tableName`. Separar de `tableName` para filtrar jobs en monitorización.
   */
  syncLogTargetTable?: string;
  conflictKeys: string[];
  logLabel: string;
  fetchRows: (sap: SapService, desde: string) => Promise<SapRecord[]>;
  mapRows: (rows: SapRecord[]) => Record<string, unknown>[];
};

/**
 * Cada corrida inserta/actualiza una fila en `sync_logs` (createSyncLog + finishSyncLog):
 * `targetTable` = `syncLogTargetTable` ?? `tableName` (status, totalProcessed, finishedAt).
 */
export async function runReporteDiarioSync(
  opts: ReporteDiarioSyncOptions
): Promise<void> {
  if (!config.enableSync) {
    logger.warn(
      { enabled: config.enableSync },
      `${opts.logLabel}: deshabilitado (ENABLE_SYNC=false; no se escribe en sync_logs)`
    );
    return;
  }

  try {
    assertSyncConfig();
  } catch (e) {
    logger.fatal(
      { err: serializeError(e) },
      `${opts.logLabel}: configuración inválida`
    );
    process.exit(1);
  }

  const sapService = new SapService();
  const databaseService = new DatabaseService();
  const started = Date.now();
  const syncLogTarget = opts.syncLogTargetTable ?? opts.tableName;
  const syncLogId = await databaseService.createSyncLog(
    syncLogTarget,
    config.batchSize
  );
  let processed = 0;

  try {
    logger.info(
      {
        desde: config.syncFechaInicio,
        tabla: opts.tableName,
        syncLogTarget,
        conflictKeys: opts.conflictKeys
      },
      `${opts.logLabel}: inicio sincronización`
    );

    const records = await opts.fetchRows(sapService, config.syncFechaInicio);
    if (records.length === 0) {
      logger.info(`${opts.logLabel}: SAP no devolvió filas`);
      return;
    }

    const rows = opts.mapRows(records);
    if (rows.length === 0) {
      logger.warn(
        { sapRows: records.length },
        `${opts.logLabel}: no se pudo mapear ninguna fila`
      );
      return;
    }

    const dedupedRows = dedupeRowsByConflictKeys(rows, opts.conflictKeys);
    const duplicatedRows = rows.length - dedupedRows.length;
    if (duplicatedRows > 0) {
      logger.warn(
        { duplicatedRows, conflictKeys: opts.conflictKeys },
        `${opts.logLabel}: filas duplicadas; se deduplican antes del upsert`
      );
    }

    const batches = chunkArray(dedupedRows, config.batchSize);
    logger.info(
      {
        totalRecords: dedupedRows.length,
        batchSize: config.batchSize,
        totalBatches: batches.length
      },
      `${opts.logLabel}: filas listas para upsert`
    );

    for (const [index, batch] of batches.entries()) {
      const count = await databaseService.bulkUpsert(
        opts.tableName,
        batch as unknown as SapRecord[],
        opts.conflictKeys
      );
      processed += count;

      logger.info(
        {
          batch: index + 1,
          totalBatches: batches.length,
          insertedOrUpdated: count,
          processed
        },
        `${opts.logLabel}: lote procesado`
      );
    }

    logger.info(
      {
        totalProcessed: processed,
        table: opts.tableName,
        syncLogTarget,
        durationMs: Date.now() - started
      },
      `${opts.logLabel}: sincronización finalizada`
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
      `${opts.logLabel}: error durante la sincronización`
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
}
