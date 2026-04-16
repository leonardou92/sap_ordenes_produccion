import type { SapRecord } from "../services/sap.service";

const pick = (row: SapRecord, ...candidates: string[]): unknown => {
  for (const key of candidates) {
    if (key in row && row[key] !== undefined) return row[key];
  }
  return undefined;
};

const str = (v: unknown): string => (v == null ? "" : String(v).trim());

const toDateOrNull = (v: unknown): Date | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(
    s.length === 8 && /^\d{8}$/.test(s)
      ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z`
      : `${s}T00:00:00Z`
  );
  return Number.isNaN(d.getTime()) ? null : d;
};

const toNumberOrNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const buildFactProduccionId = (
  ordenId: string,
  fechaFinReal: Date | null,
  unidadMedida: string
): string => {
  const fecha = fechaFinReal ? fechaFinReal.toISOString().slice(0, 10) : "sin-fecha";
  return `${ordenId}|${fecha}|${unidadMedida || "na"}`.slice(0, 140);
};

export function mapSapFactProduccionRowToSql(
  row: SapRecord
): Record<string, unknown> | null {
  const ordenId = str(pick(row, "Orden_ID", "orden_id"));
  if (!ordenId) return null;

  const fechaFinReal = toDateOrNull(pick(row, "Fecha_Fin_Real", "fecha_fin_real"));
  const unidadMedida = str(pick(row, "Unidad_Medida", "unidad_medida"));

  return {
    fact_produccion_id: buildFactProduccionId(ordenId, fechaFinReal, unidadMedida),
    orden_id: ordenId,
    centro_id: str(pick(row, "Centro_ID", "centro_id")) || null,
    producto_desc: str(pick(row, "Producto_Desc", "producto_desc")) || null,
    fecha_creacion: toDateOrNull(pick(row, "Fecha_Creacion", "fecha_creacion")),
    fecha_inicio_plan: toDateOrNull(
      pick(row, "Fecha_Inicio_Plan", "fecha_inicio_plan")
    ),
    fecha_fin_plan: toDateOrNull(pick(row, "Fecha_Fin_Plan", "fecha_fin_plan")),
    fecha_fin_real: fechaFinReal,
    cant_planificada: toNumberOrNull(
      pick(row, "Cant_Planificada", "cant_planificada")
    ),
    cant_real: toNumberOrNull(pick(row, "Cant_Real", "cant_real")),
    unidad_medida: unidadMedida || null,
    synced_at: new Date(),
    updated_at: new Date()
  };
}

export function mapSapFactProduccionRowsToSql(
  rows: SapRecord[]
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const mapped = mapSapFactProduccionRowToSql(row);
    if (mapped) out.push(mapped);
  }
  return out;
}
