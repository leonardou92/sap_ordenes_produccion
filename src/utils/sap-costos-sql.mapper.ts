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

const buildCostosId = (orden: string, materialNombre: string): string =>
  `${orden}|${materialNombre}`.slice(0, 260);

export function mapSapCostosRowToSql(
  row: SapRecord
): Record<string, unknown> | null {
  const orden = str(pick(row, "Orden", "orden"));
  if (!orden) return null;
  const materialNombre = str(pick(row, "Material_Nombre", "material_nombre"));

  return {
    kpi_costos_id: buildCostosId(orden, materialNombre),
    orden,
    fecha_creacion: toDateOrNull(pick(row, "Fecha_Creacion", "fecha_creacion")),
    centro_nombre: str(pick(row, "Centro_Nombre", "centro_nombre")) || null,
    material_nombre: materialNombre || null,
    moneda: str(pick(row, "Moneda", "moneda")) || null,
    costo_real_total: toNumberOrNull(pick(row, "Costo_Real_Total", "costo_real_total")),
    valor_almacen_estandar: toNumberOrNull(
      pick(row, "Valor_Almacen_Estandar", "valor_almacen_estandar")
    ),
    varianza_dinero: toNumberOrNull(pick(row, "Varianza_Dinero", "varianza_dinero")),
    synced_at: new Date(),
    updated_at: new Date()
  };
}

export function mapSapCostosRowsToSql(
  rows: SapRecord[]
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const mapped = mapSapCostosRowToSql(row);
    if (mapped) out.push(mapped);
  }
  return out;
}
