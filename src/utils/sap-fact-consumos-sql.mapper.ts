import type { SapRecord } from "../services/sap.service";

const pick = (row: SapRecord, ...candidates: string[]): unknown => {
  for (const key of candidates) {
    if (key in row && row[key] !== undefined) return row[key];
  }
  return undefined;
};

const str = (v: unknown): string => (v == null ? "" : String(v).trim());

const toNumberOrNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const normalizeKeyToken = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const buildFactConsumoId = (ordenId: string, componenteDesc: string): string =>
  `${normalizeKeyToken(ordenId)}|${
    normalizeKeyToken(componenteDesc) || "sin-componente"
  }`.slice(0, 180);

export function mapSapFactConsumosRowToSql(
  row: SapRecord
): Record<string, unknown> | null {
  const ordenId = str(pick(row, "Orden_ID", "orden_id"));
  if (!ordenId) return null;

  const componenteDesc = str(pick(row, "Componente_Desc", "componente_desc"));

  return {
    fact_consumo_id: buildFactConsumoId(ordenId, componenteDesc),
    orden_id: ordenId,
    componente_desc: componenteDesc || null,
    cant_necesaria: toNumberOrNull(pick(row, "Cant_Necesaria", "cant_necesaria")),
    cant_consumida_real: toNumberOrNull(
      pick(row, "Cant_Consumida_Real", "cant_consumida_real")
    ),
    unidad_medida: str(pick(row, "Unidad_Medida", "unidad_medida")) || null,
    desviacion_material: toNumberOrNull(
      pick(row, "Desviacion_Material", "desviacion_material")
    ),
    synced_at: new Date(),
    updated_at: new Date()
  };
}

export function mapSapFactConsumosRowsToSql(
  rows: SapRecord[]
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const mapped = mapSapFactConsumosRowToSql(row);
    if (mapped) out.push(mapped);
  }
  return out;
}
