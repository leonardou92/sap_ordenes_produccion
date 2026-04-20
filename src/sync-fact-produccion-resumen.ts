import {
  mapFactProduccionResumenRowsToSql
} from "./utils/sap-reporte-diario-sql.mapper";
import { runReporteDiarioSync } from "./sync-reporte-diario-runner";

const TABLE = "fact_produccion_resumen";
const KEYS = ["fecha", "codigo_planta"] as const;

void runReporteDiarioSync({
  tableName: TABLE,
  syncLogTargetTable: "PB_reporte_resumen",
  conflictKeys: [...KEYS],
  logLabel: "FACT_PRODUCCION_RESUMEN",
  fetchRows: (sap, desde) => sap.fetchFactProduccionResumen(desde),
  mapRows: mapFactProduccionResumenRowsToSql
}).finally(() => {
  process.exit(process.exitCode ?? 0);
});
