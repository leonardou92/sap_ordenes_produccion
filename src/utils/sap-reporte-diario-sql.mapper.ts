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

const toDecimalOrNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function mapFactProduccionResumenRowsToSql(
  rows: SapRecord[]
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const fecha = toDateOrNull(pick(row, "Fecha", "fecha"));
    const codigoPlanta = str(pick(row, "Codigo_Planta", "codigo_planta"));
    if (!fecha || !codigoPlanta) continue;
    out.push({
      fecha,
      codigo_planta: codigoPlanta,
      nombre_planta: str(pick(row, "Nombre_Planta", "nombre_planta")) || null,
      aves_procesadas: toDecimalOrNull(
        pick(row, "Aves_Procesadas", "aves_procesadas")
      ),
      kg_planta_total: toDecimalOrNull(
        pick(row, "KG_Planta_Total", "kg_planta_total")
      ),
      kg_granja_total: toDecimalOrNull(
        pick(row, "KG_Granja_Total", "kg_granja_total")
      ),
      dif_kg: toDecimalOrNull(pick(row, "Dif_KG", "dif_kg")),
      porcentaje_merma: toDecimalOrNull(
        pick(row, "Porcentaje_Merma", "porcentaje_merma")
      ),
      synced_at: new Date(),
      updated_at: new Date()
    });
  }
  return out;
}

export function mapFactRecepcionCamionesRowsToSql(
  rows: SapRecord[]
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const fecha = toDateOrNull(pick(row, "Fecha", "fecha"));
    const codigoPlanta = str(pick(row, "Codigo_Planta", "codigo_planta"));
    const placaLote = str(pick(row, "Placa_Lote", "placa_lote"));
    if (!fecha || !codigoPlanta || !placaLote) continue;
    out.push({
      fecha,
      codigo_planta: codigoPlanta,
      placa_lote: placaLote,
      granja_descripcion:
        str(pick(row, "Granja_Descripcion", "granja_descripcion")) || null,
      kg_granja: toDecimalOrNull(pick(row, "KG_Granja", "kg_granja")),
      kg_planta: toDecimalOrNull(pick(row, "KG_Planta", "kg_planta")),
      aves_recibidas: toDecimalOrNull(
        pick(row, "Aves_Recibidas", "aves_recibidas")
      ),
      dif_kg: toDecimalOrNull(pick(row, "Dif_KG", "dif_kg")),
      synced_at: new Date(),
      updated_at: new Date()
    });
  }
  return out;
}

export function mapFactProduccionDetalleReporteRowsToSql(
  rows: SapRecord[]
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const fecha = toDateOrNull(pick(row, "Fecha", "fecha"));
    const codigoPlanta = str(pick(row, "Codigo_Planta", "codigo_planta"));
    const codigoProducto = str(pick(row, "Codigo_Producto", "codigo_producto"));
    if (!fecha || !codigoPlanta || !codigoProducto) continue;
    out.push({
      fecha,
      codigo_planta: codigoPlanta,
      codigo_producto: codigoProducto,
      referencia: str(pick(row, "Referencia", "referencia")) || null,
      kg_producidos: toDecimalOrNull(
        pick(row, "KG_Producidos", "kg_producidos")
      ),
      synced_at: new Date(),
      updated_at: new Date()
    });
  }
  return out;
}

export function mapFactMaterialesEmpaqueRowsToSql(
  rows: SapRecord[]
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const fecha = toDateOrNull(pick(row, "Fecha", "fecha"));
    const codigoPlanta = str(pick(row, "Codigo_Planta", "codigo_planta"));
    const codigoMaterial = str(
      pick(row, "Codigo_Material", "codigo_material")
    );
    const unidad = str(pick(row, "Unidad", "unidad"));
    if (!fecha || !codigoPlanta || !codigoMaterial || !unidad) continue;
    out.push({
      fecha,
      codigo_planta: codigoPlanta,
      codigo_material: codigoMaterial,
      descripcion_material:
        str(pick(row, "Descripcion_Material", "descripcion_material")) ||
        null,
      cantidad_consumida: toDecimalOrNull(
        pick(row, "Cantidad_Consumida", "cantidad_consumida")
      ),
      unidad,
      synced_at: new Date(),
      updated_at: new Date()
    });
  }
  return out;
}
