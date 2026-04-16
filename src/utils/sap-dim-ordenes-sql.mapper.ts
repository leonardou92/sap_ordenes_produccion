import type { SapRecord } from "../services/sap.service";

const pick = (row: SapRecord, ...candidates: string[]): unknown => {
  for (const key of candidates) {
    if (key in row && row[key] !== undefined) return row[key];
  }
  return undefined;
};

const str = (v: unknown): string => (v == null ? "" : String(v).trim());

export function mapSapDimOrdenesRowToSql(
  row: SapRecord
): Record<string, unknown> | null {
  const ordenId = str(pick(row, "Orden_ID", "orden_id"));
  if (!ordenId) return null;

  return {
    orden_id: ordenId,
    tipo_orden_desc: str(pick(row, "Tipo_Orden_Desc", "tipo_orden_desc")) || null,
    centro_desc: str(pick(row, "Centro_Desc", "centro_desc")) || null,
    estatus_actual: str(pick(row, "Estatus_Actual", "estatus_actual")) || null,
    synced_at: new Date(),
    updated_at: new Date()
  };
}

export function mapSapDimOrdenesRowsToSql(
  rows: SapRecord[]
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const mapped = mapSapDimOrdenesRowToSql(row);
    if (mapped) out.push(mapped);
  }
  return out;
}
