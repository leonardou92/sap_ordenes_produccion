import { config } from "./config";
import { DatabaseService } from "./services/database.service";
import { SapService } from "./services/sap.service";
import { logger } from "./utils/logger";
import { mapSapOrdenRowsToSql } from "./utils/sap-ordenes-sql.mapper";
import type { SapRecord } from "./services/sap.service";

const chunkArray = <T>(items: T[], batchSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    chunks.push(items.slice(i, i + batchSize));
  }
  return chunks;
};

/** Fecha actual UTC como YYYY-MM-DD (tope del rango ERDAT en SAP). */
function todayYyyyMmDdUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const runSync = async (): Promise<void> => {
  const sapService = new SapService();
  const databaseService = new DatabaseService();

  try {
    logger.info("Inicio de sincronización SAP -> SQL");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(config.syncErdatFrom)) {
      throw new Error(
        "SYNC_ERDAT_FROM es obligatorio y debe ser YYYY-MM-DD (fecha inicial ERDAT en SAP)."
      );
    }

    const hasta = todayYyyyMmDdUtc();
    logger.info(
      {
        desde: config.syncErdatFrom,
        hasta,
        werks: config.syncWerks ?? null,
        tabla: config.syncTable,
        conflictKeys: config.syncConflictKeys
      },
      "Consultando SAP por rango ERDAT hasta hoy (UTC)"
    );

    const records = await sapService.fetchOrdenesProduccionByRango(
      config.syncErdatFrom,
      hasta,
      config.syncWerks
    );
    if (records.length === 0) {
      logger.info("SAP no devolvió filas en el rango");
      return;
    }

    const rows = mapSapOrdenRowsToSql(records);
    if (rows.length === 0) {
      logger.warn(
        { sapRows: records.length },
        "No se pudo mapear ninguna fila (¿faltan Orden/Posicion?)"
      );
      return;
    }

    const batches = chunkArray(rows, config.syncBatchSize);
    logger.info(
      {
        totalRecords: rows.length,
        batchSize: config.syncBatchSize,
        totalBatches: batches.length
      },
      "Filas listas para upsert en SQL Server"
    );

    let processed = 0;
    for (const [index, batch] of batches.entries()) {
      const count = await databaseService.bulkUpsert(
        config.syncTable,
        batch as unknown as SapRecord[],
        config.syncConflictKeys
      );
      processed += count;

      logger.info(
        {
          batch: index + 1,
          totalBatches: batches.length,
          insertedOrUpdated: count,
          processed
        },
        "Lote procesado"
      );
    }

    logger.info(
      { totalProcessed: processed, table: config.syncTable },
      "Sincronización finalizada con éxito"
    );
  } catch (error) {
    logger.error({ error }, "Error durante la sincronización");
    process.exitCode = 1;
  } finally {
    try {
      await databaseService.close();
    } catch (closeError) {
      logger.error({ closeError }, "Error cerrando conexión de base de datos");
      process.exitCode = 1;
    }
  }
};

void runSync();
