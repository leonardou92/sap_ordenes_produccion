import { config } from "./config";
import { DatabaseService } from "./services/database.service";
import { SapRecord, SapService } from "./services/sap.service";
import { logger } from "./utils/logger";

const chunkArray = <T>(items: T[], batchSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    chunks.push(items.slice(i, i + batchSize));
  }
  return chunks;
};

const runSync = async (): Promise<void> => {
  const sapService = new SapService();
  const databaseService = new DatabaseService();

  try {
    logger.info("Inicio de sincronización SAP -> SQL");

    const records: SapRecord[] = await sapService.fetchData();
    if (records.length === 0) {
      logger.info("No hay registros para sincronizar");
      return;
    }

    const batches = chunkArray(records, config.syncBatchSize);
    logger.info(
      {
        totalRecords: records.length,
        batchSize: config.syncBatchSize,
        totalBatches: batches.length
      },
      "Datos listos para procesamiento por lotes"
    );

    let processed = 0;
    for (const [index, batch] of batches.entries()) {
      const count = await databaseService.bulkUpsert(
        config.syncTable,
        batch,
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
