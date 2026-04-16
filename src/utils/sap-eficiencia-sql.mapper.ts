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

const buildEficienciaId = (
  orden: string,
  fechaTrabajo: Date | null,
  materialNombre: string
): string => {
  const fecha = fechaTrabajo ? fechaTrabajo.toISOString().slice(0, 10) : "sin-fecha";
  return `${orden}|${fecha}|${materialNombre}`.slice(0, 260);
};

export function mapSapEficienciaRowToSql(
  row: SapRecord
): Record<string, unknown> | null {
  const orden = str(pick(row, "Orden", "orden"));
  if (!orden) return null;

  const fechaTrabajo = toDateOrNull(pick(row, "Fecha_Trabajo", "fecha_trabajo"));
  const materialNombre = str(pick(row, "Material_Nombre", "material_nombre"));

  return {
    kpi_eficiencia_id: buildEficienciaId(orden, fechaTrabajo, materialNombre),
    orden,
    fecha_creacion_orden: toDateOrNull(
      pick(row, "Fecha_Creacion_Orden", "fecha_creacion_orden")
    ),
    fecha_trabajo: fechaTrabajo,
    centro_nombre: str(pick(row, "Centro_Nombre", "centro_nombre")) || null,
    material_nombre: materialNombre || null,
    cant_buena: toNumberOrNull(pick(row, "Cant_Buena", "cant_buena")),
    cant_scrap: toNumberOrNull(pick(row, "Cant_Scrap", "cant_scrap")),
    horas_mano_obra: toNumberOrNull(pick(row, "Horas_ManoObra", "horas_mano_obra")),
    piezas_por_hora: toNumberOrNull(pick(row, "Piezas_Por_Hora", "piezas_por_hora")),
    synced_at: new Date(),
    updated_at: new Date()
  };
}

export function mapSapEficienciaRowsToSql(
  rows: SapRecord[]
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const mapped = mapSapEficienciaRowToSql(row);
    if (mapped) out.push(mapped);
  }
  return out;
}
