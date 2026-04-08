export const SYBASE_QUERIES = {
  fetchOrdenesProduccion: `
    SELECT
      id,
      numero_orden,
      centro,
      material,
      cantidad_plan,
      unidad_medida,
      fecha_inicio,
      fecha_fin,
      estado
    FROM ordenes_produccion
  `
} as const;

export const buildOrdenesProduccionRangoQuery = (
  fromDateSap: string,
  toDateSap: string,
  werks?: string
): string => `
SELECT
    ordenesResumen.AUFNR AS "Orden",
    fechasOrden.PLNBEZ AS "Cod_Producto_Principal",
    descPrincipal.MAKTX AS "Desc_Producto_Principal",
    ordenesDetalles.MATNR AS "Cod_Material_Detalle",
    materiales.MAKTX AS "Descripcion_Material_Detalle",
    CASE
        WHEN ordenesResumen.ERDAT = '00000000' THEN NULL
        ELSE CONVERT(VARCHAR(10), CONVERT(DATETIME, ordenesResumen.ERDAT), 23)
    END AS "Fecha_Creacion",
    CASE
        WHEN fechasOrden.GSTRP = '00000000' THEN NULL
        ELSE CONVERT(VARCHAR(10), CONVERT(DATETIME, fechasOrden.GSTRP), 23)
    END AS "Fecha_Inicio_Plan",
    CASE
        WHEN fechasOrden.GLTRP = '00000000' THEN NULL
        ELSE CONVERT(VARCHAR(10), CONVERT(DATETIME, fechasOrden.GLTRP), 23)
    END AS "Fecha_Fin_Plan",
    CASE
        WHEN fechasOrden.GSTRI = '00000000' THEN NULL
        ELSE CONVERT(VARCHAR(10), CONVERT(DATETIME, fechasOrden.GSTRI), 23)
    END AS "Fecha_Inicio_Real",
    CASE
        WHEN fechasOrden.GETRI = '00000000' THEN NULL
        ELSE CONVERT(VARCHAR(10), CONVERT(DATETIME, fechasOrden.GETRI), 23)
    END AS "Fecha_Fin_Real",
    ordenesDetalles.PSMNG AS "Cant_Planeada",
    ordenesDetalles.WEMNG AS "Cant_Producida_Real",
    ordenesDetalles.AMEIN AS "Unidad_Medida",
    tiposOrden.TXT AS "Tipo_Orden"
FROM SAPSR3.AUFK AS ordenesResumen
INNER JOIN SAPSR3.AFKO AS fechasOrden ON ordenesResumen.AUFNR = fechasOrden.AUFNR
INNER JOIN SAPSR3.AFPO AS ordenesDetalles ON ordenesResumen.AUFNR = ordenesDetalles.AUFNR
INNER JOIN SAPSR3.MAKT AS materiales ON ordenesDetalles.MATNR = materiales.MATNR AND materiales.SPRAS = 'S'
LEFT JOIN SAPSR3.MAKT AS descPrincipal ON fechasOrden.PLNBEZ = descPrincipal.MATNR AND descPrincipal.SPRAS = 'S'
INNER JOIN SAPSR3.T003P AS tiposOrden ON ordenesResumen.AUART = tiposOrden.AUART AND tiposOrden.SPRAS = 'S'
WHERE
    ordenesResumen.ERDAT BETWEEN '${fromDateSap}' AND '${toDateSap}'
    ${werks ? `AND ordenesResumen.WERKS = '${werks}'` : ""}
ORDER BY
    ordenesResumen.AUFNR ASC,
    ordenesDetalles.POSNR ASC;
`;
