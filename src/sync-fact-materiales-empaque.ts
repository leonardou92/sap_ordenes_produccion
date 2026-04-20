import {
  mapFactMaterialesEmpaqueRowsToSql
} from "./utils/sap-reporte-diario-sql.mapper";
import { runReporteDiarioSync } from "./sync-reporte-diario-runner";

const TABLE = "fact_materiales_empaque";
const KEYS = ["fecha", "codigo_planta", "codigo_material", "unidad"] as const;

void runReporteDiarioSync({
  tableName: TABLE,
  syncLogTargetTable: "PB_reporte_materiales_empaque",
  conflictKeys: [...KEYS],
  logLabel: "FACT_MATERIALES_EMPAQUE",
  fetchRows: (sap, desde) => sap.fetchFactMaterialesEmpaque(desde),
  mapRows: mapFactMaterialesEmpaqueRowsToSql
}).finally(() => {
  process.exit(process.exitCode ?? 0);
});
