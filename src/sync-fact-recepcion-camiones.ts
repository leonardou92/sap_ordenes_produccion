import {
  mapFactRecepcionCamionesRowsToSql
} from "./utils/sap-reporte-diario-sql.mapper";
import { runReporteDiarioSync } from "./sync-reporte-diario-runner";

const TABLE = "fact_recepcion_camiones";
const KEYS = ["fecha", "codigo_planta", "placa_lote"] as const;

void runReporteDiarioSync({
  tableName: TABLE,
  syncLogTargetTable: "PB_reporte_recepcion_camiones",
  conflictKeys: [...KEYS],
  logLabel: "FACT_RECEPCION_CAMIONES",
  fetchRows: (sap, desde) => sap.fetchFactRecepcionCamiones(desde),
  mapRows: mapFactRecepcionCamionesRowsToSql
}).finally(() => {
  process.exit(process.exitCode ?? 0);
});
