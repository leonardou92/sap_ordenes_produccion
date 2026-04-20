import type { SapRecord } from "../services/sap.service";

const pick = (row: SapRecord, ...candidates: string[]): unknown => {
  for (const key of candidates) {
    if (key in row && row[key] !== undefined) return row[key];
  }
  return undefined;
};

const str = (v: unknown): string => (v == null ? "" : String(v).trim());

export function mapSapDimPlantasRowsToSql(
  rows: SapRecord[]
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const codigoPlanta = str(pick(row, "Codigo_Planta", "codigo_planta", "WERKS"));
    if (!codigoPlanta) continue;

    out.push({
      codigo_planta: codigoPlanta,
      nombre_planta: str(
        pick(row, "Nombre_Planta", "nombre_planta", "NAME1")
      ) || null,
      sociedad_codigo: str(
        pick(row, "Sociedad_Codigo", "sociedad_codigo", "BUKRS")
      ) || null,
      centro_valoracion: str(
        pick(row, "Centro_Valoracion", "centro_valoracion", "BWKEY")
      ) || null,
      ciudad: str(pick(row, "Ciudad", "ciudad", "ORT01")) || null,
      pais: str(pick(row, "Pais", "pais", "LAND1")) || null,
      synced_at: new Date(),
      updated_at: new Date()
    });
  }
  return out;
}
