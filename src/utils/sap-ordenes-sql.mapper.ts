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
  const d = new Date(s.length === 8 && /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z` : `${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const toDecimal = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const buildSapLineId = (orden: string, posicion: string, stat: string): string =>
  `${orden}|${posicion}|${stat}`.slice(0, 132);

/** Fila lista para Knex / SQL Server (snake_case, coincide con columnas Prisma @@map). */
export function mapSapOrdenRowToSql(row: SapRecord): Record<string, unknown> | null {
  const orden = str(pick(row, "Orden", "orden"));
  const posicion = str(pick(row, "Posicion", "posicion"));
  const statSistema = str(pick(row, "Stat_Sistema", "stat_sistema", "STAT"));
  if (!orden || !posicion || !statSistema) return null;

  const sapLineId = buildSapLineId(orden, posicion, statSistema);

  return {
    sap_line_id: sapLineId,
    orden,
    posicion,
    stat_sistema: statSistema,
    cod_producto_principal: str(pick(row, "Cod_Producto_Principal", "cod_producto_principal")) || null,
    desc_producto_principal: str(pick(row, "Desc_Producto_Principal", "desc_producto_principal")) || null,
    cod_material_detalle: str(pick(row, "Cod_Material_Detalle", "cod_material_detalle")) || null,
    descripcion_material_detalle:
      str(pick(row, "Descripcion_Material_Detalle", "descripcion_material_detalle")) || null,
    estatus_breve: str(pick(row, "Estatus_Breve", "estatus_breve")) || null,
    estatus_detallado: str(pick(row, "Estatus_Detallado", "estatus_detallado")) || null,
    fecha_creacion: toDateOrNull(pick(row, "Fecha_Creacion", "fecha_creacion")),
    fecha_inicio_plan: toDateOrNull(pick(row, "Fecha_Inicio_Plan", "fecha_inicio_plan")),
    fecha_fin_plan: toDateOrNull(pick(row, "Fecha_Fin_Plan", "fecha_fin_plan")),
    fecha_inicio_real: toDateOrNull(pick(row, "Fecha_Inicio_Real", "fecha_inicio_real")),
    fecha_fin_real: toDateOrNull(pick(row, "Fecha_Fin_Real", "fecha_fin_real")),
    cant_planeada: toDecimal(pick(row, "Cant_Planeada", "cant_planeada")),
    cant_producida_real: toDecimal(pick(row, "Cant_Producida_Real", "cant_producida_real")),
    unidad_medida: str(pick(row, "Unidad_Medida", "unidad_medida")) || null,
    tipo_orden: str(pick(row, "Tipo_Orden", "tipo_orden")) || null,
    synced_at: new Date(),
    updated_at: new Date()
  };
}

export function mapSapOrdenRowsToSql(rows: SapRecord[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const mapped = mapSapOrdenRowToSql(row);
    if (mapped) out.push(mapped);
  }
  return out;
}
