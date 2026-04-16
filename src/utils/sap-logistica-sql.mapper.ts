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

const toIntFlag = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return n === 1 ? 1 : 0;
};

export function mapSapLogisticaRowToSql(
  row: SapRecord
): Record<string, unknown> | null {
  const orden = str(pick(row, "Orden", "orden"));
  if (!orden) return null;

  return {
    orden,
    orden_descripcion:
      str(pick(row, "Orden_Descripcion", "orden_descripcion")) || null,
    tipo_orden_cod: str(pick(row, "Tipo_Orden_Cod", "tipo_orden_cod")) || null,
    tipo_orden_desc:
      str(pick(row, "Tipo_Orden_Desc", "tipo_orden_desc")) || null,
    fecha_creacion: toDateOrNull(pick(row, "Fecha_Creacion", "fecha_creacion")),
    fecha_plan_fin: toDateOrNull(pick(row, "Fecha_Plan_Fin", "fecha_plan_fin")),
    fecha_real_fin: toDateOrNull(pick(row, "Fecha_Real_Fin", "fecha_real_fin")),
    centro_nombre: str(pick(row, "Centro_Nombre", "centro_nombre")) || null,
    material_nombre: str(pick(row, "Material_Nombre", "material_nombre")) || null,
    kpi_a_tiempo: toIntFlag(pick(row, "KPI_A_Tiempo", "kpi_a_tiempo")),
    cant_planificada: toNumberOrNull(
      pick(row, "Cant_Planificada", "cant_planificada")
    ),
    cant_entregada: toNumberOrNull(pick(row, "Cant_Entregada", "cant_entregada")),
    synced_at: new Date(),
    updated_at: new Date()
  };
}

export function mapSapLogisticaRowsToSql(
  rows: SapRecord[]
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const mapped = mapSapLogisticaRowToSql(row);
    if (mapped) out.push(mapped);
  }
  return out;
}
