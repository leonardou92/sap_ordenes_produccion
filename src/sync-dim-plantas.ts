import { mapSapDimPlantasRowsToSql } from "./utils/sap-dim-plantas-sql.mapper";
import { runReporteDiarioSync } from "./sync-reporte-diario-runner";

const TABLE = "dim_plantas";
const KEYS = ["codigo_planta"] as const;

void runReporteDiarioSync({
  tableName: TABLE,
  syncLogTargetTable: "dim_plantas",
  conflictKeys: [...KEYS],
  logLabel: "DIM_PLANTAS",
  fetchRows: (sap) => sap.fetchDimPlantas(),
  mapRows: mapSapDimPlantasRowsToSql
}).finally(() => {
  process.exit(process.exitCode ?? 0);
});
