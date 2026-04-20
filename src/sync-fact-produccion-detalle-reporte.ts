import {
  mapFactProduccionDetalleReporteRowsToSql
} from "./utils/sap-reporte-diario-sql.mapper";
import { runReporteDiarioSync } from "./sync-reporte-diario-runner";

const TABLE = "fact_produccion_detalle_reporte";
const KEYS = ["fecha", "codigo_planta", "codigo_producto"] as const;

void runReporteDiarioSync({
  tableName: TABLE,
  syncLogTargetTable: "PB_reporte_produccion_detalle",
  conflictKeys: [...KEYS],
  logLabel: "FACT_PRODUCCION_DETALLE_REPORTE",
  fetchRows: (sap, desde) => sap.fetchFactProduccionDetalleReporte(desde),
  mapRows: mapFactProduccionDetalleReporteRowsToSql
}).finally(() => {
  process.exit(process.exitCode ?? 0);
});
