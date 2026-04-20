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
    ordenesDetalles.POSNR AS "Posicion",
    fechasOrden.PLNBEZ AS "Cod_Producto_Principal",
    descPrincipal.MAKTX AS "Desc_Producto_Principal",
    ordenesDetalles.MATNR AS "Cod_Material_Detalle",
    materiales.MAKTX AS "Descripcion_Material_Detalle",
    statusTexto.TXT04 AS "Estatus_Breve",
    statusTexto.TXT30 AS "Estatus_Detallado",
    estatusActivos.STAT AS "Stat_Sistema",
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
INNER JOIN SAPSR3.JEST AS estatusActivos ON ordenesResumen.OBJNR = estatusActivos.OBJNR
INNER JOIN SAPSR3.TJ02T AS statusTexto ON estatusActivos.STAT = statusTexto.ISTAT AND statusTexto.SPRAS = 'S'
WHERE
    ordenesResumen.ERDAT BETWEEN '${fromDateSap}' AND '${toDateSap}'
    ${werks ? `AND ordenesResumen.WERKS = '${werks}'` : ""}
    AND estatusActivos.INACT = ''
ORDER BY
    ordenesResumen.AUFNR ASC,
    ordenesDetalles.POSNR ASC,
    estatusActivos.STAT ASC
`;

export const buildKpiProdLogisticaQuery = (fromDateSap: string): string => `
SELECT
    A.AUFNR AS "Orden",
    ISNULL(A.KTEXT, 'Sin Descripcion') AS "Orden_Descripcion",
    A.AUART AS "Tipo_Orden_Cod",
    ISNULL(T.TXT, 'Estandar') AS "Tipo_Orden_Desc",
    CASE WHEN A.ERDAT = '00000000' THEN NULL ELSE CONVERT(VARCHAR(10), CONVERT(DATETIME, A.ERDAT), 23) END AS "Fecha_Creacion",
    ISNULL(W.NAME1, 'Planta Principal') AS "Centro_Nombre",
    ISNULL(M.MAKTX, P.MATNR) AS "Material_Nombre",
    CASE WHEN K.GLTRP = '00000000' THEN NULL ELSE CONVERT(VARCHAR(10), CONVERT(DATETIME, K.GLTRP), 23) END AS "Fecha_Plan_Fin",
    CASE WHEN K.GETRI = '00000000' THEN NULL ELSE CONVERT(VARCHAR(10), CONVERT(DATETIME, K.GETRI), 23) END AS "Fecha_Real_Fin",
    CASE
        WHEN K.GETRI = '00000000' THEN NULL
        WHEN CONVERT(DATETIME, K.GETRI) <= CONVERT(DATETIME, K.GLTRP) THEN 1
        ELSE 0
    END AS "KPI_A_Tiempo",
    CAST(ISNULL(K.GAMNG, 0) AS FLOAT) AS "Cant_Planificada",
    CAST(ISNULL(P.WEMNG, 0) AS FLOAT) AS "Cant_Entregada"
FROM SAPSR3.AUFK A
INNER JOIN SAPSR3.AFKO K ON A.AUFNR = K.AUFNR
INNER JOIN SAPSR3.AFPO P ON A.AUFNR = P.AUFNR
LEFT JOIN SAPSR3.T001W W ON A.WERKS = W.WERKS
LEFT JOIN SAPSR3.MAKT M ON P.MATNR = M.MATNR AND M.SPRAS = 'S'
LEFT JOIN SAPSR3.T003P T ON A.AUART = T.AUART AND T.SPRAS = 'S'
WHERE A.AUTYP = '10'
  AND A.ERDAT >= '${fromDateSap}'
`;

export const buildKpiProdEficienciaQuery = (fromDateSap: string): string => `
SELECT
    R.AUFNR AS "Orden",
    CASE WHEN MAX(A.ERDAT) = '00000000' THEN NULL ELSE CONVERT(VARCHAR(10), CONVERT(DATETIME, MAX(A.ERDAT)), 23) END AS "Fecha_Creacion_Orden",
    CASE WHEN R.ERSDA = '00000000' THEN NULL ELSE CONVERT(VARCHAR(10), CONVERT(DATETIME, R.ERSDA), 23) END AS "Fecha_Trabajo",
    MAX(ISNULL(W.NAME1, 'Planta Principal')) AS "Centro_Nombre",
    MAX(ISNULL(M.MAKTX, 'Material Indefinido')) AS "Material_Nombre",
    SUM(CAST(ISNULL(R.LMNGA, 0) AS FLOAT)) AS "Cant_Buena",
    SUM(CAST(ISNULL(R.XMNGA, 0) AS FLOAT)) AS "Cant_Scrap",
    SUM(CAST(ISNULL(R.ISM03, 0) AS FLOAT)) AS "Horas_ManoObra",
    SUM(CAST(ISNULL(R.LMNGA, 0) AS FLOAT)) / NULLIF(SUM(CAST(ISNULL(R.ISM03, 0) AS FLOAT)), 0) AS "Piezas_Por_Hora"
FROM SAPSR3.AFRU R
INNER JOIN SAPSR3.AUFK A ON R.AUFNR = A.AUFNR
INNER JOIN SAPSR3.AFPO P ON R.AUFNR = P.AUFNR
LEFT JOIN SAPSR3.T001W W ON A.WERKS = W.WERKS
LEFT JOIN SAPSR3.MAKT M ON P.MATNR = M.MATNR AND M.SPRAS = 'S'
WHERE R.STZHL = 0
  AND R.ERSDA >= '${fromDateSap}'
GROUP BY
    R.AUFNR,
    R.ERSDA
`;

export const buildKpiProdCostosQuery = (fromDateSap: string): string => `
SELECT
    A.AUFNR AS "Orden",
    CASE WHEN A.ERDAT = '00000000' THEN NULL ELSE CONVERT(VARCHAR(10), CONVERT(DATETIME, A.ERDAT), 23) END AS "Fecha_Creacion",
    ISNULL(W.NAME1, 'Planta') AS "Centro_Nombre",
    ISNULL(M.MAKTX, 'Material') AS "Material_Nombre",
    A.WAERS AS "Moneda",
    (ISNULL(C1.Costo_Mat, 0) + ISNULL(C2.Costo_Act, 0)) AS "Costo_Real_Total",
    CAST(ISNULL(P.WEMNG, 0) AS FLOAT) * ISNULL(PR.Precio_Std, 0) AS "Valor_Almacen_Estandar",
    ((ISNULL(C1.Costo_Mat, 0) + ISNULL(C2.Costo_Act, 0)) - (CAST(ISNULL(P.WEMNG, 0) AS FLOAT) * ISNULL(PR.Precio_Std, 0))) AS "Varianza_Dinero"
FROM SAPSR3.AUFK A
INNER JOIN SAPSR3.AFPO P ON A.AUFNR = P.AUFNR
LEFT JOIN SAPSR3.MAKT M ON P.MATNR = M.MATNR AND M.SPRAS = 'S'
LEFT JOIN SAPSR3.T001W W ON A.WERKS = W.WERKS
LEFT JOIN (
    SELECT OBJNR, SUM(CAST(WOG001 AS FLOAT) + CAST(WOG002 AS FLOAT) + CAST(WOG003 AS FLOAT) +
               CAST(WOG004 AS FLOAT) + CAST(WOG005 AS FLOAT) + CAST(WOG006 AS FLOAT) +
               CAST(WOG007 AS FLOAT) + CAST(WOG008 AS FLOAT) + CAST(WOG009 AS FLOAT) +
               CAST(WOG010 AS FLOAT) + CAST(WOG011 AS FLOAT) + CAST(WOG012 AS FLOAT)) AS Costo_Mat
    FROM SAPSR3.COSP WHERE WRTTP = '04' GROUP BY OBJNR
) C1 ON A.OBJNR = C1.OBJNR
LEFT JOIN (
    SELECT OBJNR, SUM(CAST(WOG001 AS FLOAT) + CAST(WOG002 AS FLOAT) + CAST(WOG003 AS FLOAT) +
               CAST(WOG004 AS FLOAT) + CAST(WOG005 AS FLOAT) + CAST(WOG006 AS FLOAT) +
               CAST(WOG007 AS FLOAT) + CAST(WOG008 AS FLOAT) + CAST(WOG009 AS FLOAT) +
               CAST(WOG010 AS FLOAT) + CAST(WOG011 AS FLOAT) + CAST(WOG012 AS FLOAT)) AS Costo_Act
    FROM SAPSR3.COSS WHERE WRTTP = '04' GROUP BY OBJNR
) C2 ON A.OBJNR = C2.OBJNR
LEFT JOIN (
    SELECT MATNR, BWKEY, (CAST(STPRS AS FLOAT) / NULLIF(CAST(PEINH AS FLOAT), 0)) AS Precio_Std
    FROM SAPSR3.MBEW
) PR ON P.MATNR = PR.MATNR AND A.WERKS = PR.BWKEY
WHERE A.AUTYP = '10'
  AND A.ERDAT >= '${fromDateSap}'
`;

export const buildFactProduccionQuery = (fromDateSap: string): string => `
SELECT
    A.AUFNR AS "Orden_ID",
    A.WERKS AS "Centro_ID",
    M.MAKTX AS "Producto_Desc",
    CASE WHEN A.ERDAT = '00000000' THEN NULL ELSE CONVERT(VARCHAR(10), CONVERT(DATETIME, A.ERDAT), 23) END AS "Fecha_Creacion",
    CASE WHEN B.GSTRP = '00000000' THEN NULL ELSE CONVERT(VARCHAR(10), CONVERT(DATETIME, B.GSTRP), 23) END AS "Fecha_Inicio_Plan",
    CASE WHEN B.GLTRP = '00000000' THEN NULL ELSE CONVERT(VARCHAR(10), CONVERT(DATETIME, B.GLTRP), 23) END AS "Fecha_Fin_Plan",
    CASE WHEN B.GETRI = '00000000' THEN NULL ELSE CONVERT(VARCHAR(10), CONVERT(DATETIME, B.GETRI), 23) END AS "Fecha_Fin_Real",
    CAST(ISNULL(C.PSMNG, 0) AS FLOAT) AS "Cant_Planificada",
    CAST(ISNULL(C.WEMNG, 0) AS FLOAT) AS "Cant_Real",
    C.AMEIN AS "Unidad_Medida"
FROM SAPSR3.AUFK A
INNER JOIN SAPSR3.AFKO B ON A.AUFNR = B.AUFNR
INNER JOIN SAPSR3.AFPO C ON A.AUFNR = C.AUFNR
INNER JOIN SAPSR3.MAKT M ON C.MATNR = M.MATNR AND M.SPRAS = 'S'
WHERE A.ERDAT >= '${fromDateSap}'
`;

export const buildFactConsumosQuery = (): string => `
SELECT
    R.AUFNR AS "Orden_ID",
    M.MAKTX AS "Componente_Desc",
    CAST(ISNULL(R.BDMNG, 0) AS FLOAT) AS "Cant_Necesaria",
    CAST(ISNULL(R.ENMNG, 0) AS FLOAT) AS "Cant_Consumida_Real",
    R.MEINS AS "Unidad_Medida",
    CAST(ISNULL(R.ENMNG, 0) AS FLOAT) - CAST(ISNULL(R.BDMNG, 0) AS FLOAT) AS "Desviacion_Material"
FROM SAPSR3.RESB R
INNER JOIN SAPSR3.MAKT M ON R.MATNR = M.MATNR AND M.SPRAS = 'S'
WHERE R.BAUGR <> ''
  AND R.XLOEK = ''
`;

export const buildDimOrdenesQuery = (fromDateSap: string): string => `
SELECT
    A.AUFNR AS "Orden_ID",
    T.TXT AS "Tipo_Orden_Desc",
    P.NAME1 AS "Centro_Desc",
    ST.TXT30 AS "Estatus_Actual"
FROM SAPSR3.AUFK A
INNER JOIN SAPSR3.T003P T ON A.AUART = T.AUART AND T.SPRAS = 'S'
INNER JOIN SAPSR3.T001W P ON A.WERKS = P.WERKS
INNER JOIN SAPSR3.JEST J ON A.OBJNR = J.OBJNR
INNER JOIN SAPSR3.TJ02T ST ON J.STAT = ST.ISTAT AND ST.SPRAS = 'S'
WHERE A.ERDAT >= '${fromDateSap}'
  AND J.INACT = ''
  AND J.STAT = (
    SELECT MAX(J2.STAT)
    FROM SAPSR3.JEST J2
    WHERE J2.OBJNR = A.OBJNR
      AND J2.INACT = ''
  )
`;

/** Catálogo de plantas (T001W) para plantas PB. */
export const buildDimPlantasQuery = (): string => `
SELECT
    p.WERKS AS "Codigo_Planta",
    p.NAME1 AS "Nombre_Planta",
    p.BWKEY AS "Centro_Valoracion",
    p.ORT01 AS "Ciudad",
    p.LAND1 AS "Pais"
FROM SAPSR3.T001W p
WHERE p.WERKS LIKE 'PB%'
`;

/** Reporte diario: resumen por planta y fecha (GSTRI). Filtro desde fecha SAP YYYYMMDD. */
export const buildFactProduccionResumenQuery = (fromDateSap: string): string => `
SELECT
    CONVERT(DATE, A.GSTRI, 112) AS "Fecha",
    O.WERKS AS "Codigo_Planta",
    W.NAME1 AS "Nombre_Planta",
    CAST(SUM(A.GAMNG) / 2.35 AS DECIMAL(18,0)) AS "Aves_Procesadas",
    CAST(SUM(ISNULL(Prod.KG_Planta, 0)) AS DECIMAL(18,2)) AS "KG_Planta_Total",
    CAST(SUM(A.GAMNG) AS DECIMAL(18,2)) AS "KG_Granja_Total",
    CAST(SUM(ISNULL(Prod.KG_Planta, 0)) - SUM(A.GAMNG) AS DECIMAL(18,2)) AS "Dif_KG",
    CAST(((SUM(ISNULL(Prod.KG_Planta, 0)) - SUM(A.GAMNG)) / NULLIF(SUM(A.GAMNG), 0)) * 100 AS DECIMAL(18,2)) AS "Porcentaje_Merma"
FROM SAPSR3.AFKO A
INNER JOIN SAPSR3.AUFK O ON A.AUFNR = O.AUFNR
LEFT JOIN SAPSR3.T001W W ON O.WERKS = W.WERKS
LEFT JOIN (
    SELECT AUFNR, SUM(WEMNG) AS KG_Planta
    FROM SAPSR3.AFPO
    WHERE AMEIN IN ('KG', 'KGM') GROUP BY AUFNR
) Prod ON A.AUFNR = Prod.AUFNR
WHERE A.GSTRI >= '${fromDateSap}' AND O.WERKS LIKE 'PB%'
GROUP BY A.GSTRI, O.WERKS, W.NAME1
`;

/** Recepción por camión / lote (posición 0001). */
export const buildFactRecepcionCamionesQuery = (fromDateSap: string): string => `
SELECT
    CONVERT(DATE, A.GSTRI, 112) AS "Fecha",
    O.WERKS AS "Codigo_Planta",
    P.CHARG AS "Placa_Lote",
    M.MAKTX AS "Granja_Descripcion",
    CAST(P.PSMNG AS DECIMAL(18,2)) AS "KG_Granja",
    CAST(P.WEMNG AS DECIMAL(18,2)) AS "KG_Planta",
    CAST(P.PSMNG / 2.35 AS DECIMAL(18,0)) AS "Aves_Recibidas",
    CAST(P.WEMNG - P.PSMNG AS DECIMAL(18,2)) AS "Dif_KG"
FROM SAPSR3.AFPO P
INNER JOIN SAPSR3.AFKO A ON P.AUFNR = A.AUFNR
INNER JOIN SAPSR3.AUFK O ON A.AUFNR = O.AUFNR
INNER JOIN SAPSR3.MAKT M ON P.MATNR = M.MATNR AND M.SPRAS = 'S'
WHERE A.GSTRI >= '${fromDateSap}'
  AND P.POSNR = '0001' AND O.WERKS LIKE 'PB%'
ORDER BY A.GSTRI, P.CHARG
`;

/** Despiece / productos en KG. */
export const buildFactProduccionDetalleReporteQuery = (fromDateSap: string): string => `
SELECT
    CONVERT(DATE, A.GSTRI, 112) AS "Fecha",
    O.WERKS AS "Codigo_Planta",
    P.MATNR AS "Codigo_Producto",
    M.MAKTX AS "Referencia",
    CAST(SUM(P.WEMNG) AS DECIMAL(18,2)) AS "KG_Producidos"
FROM SAPSR3.AFPO P
INNER JOIN SAPSR3.MAKT M ON P.MATNR = M.MATNR AND M.SPRAS = 'S'
INNER JOIN SAPSR3.AFKO A ON P.AUFNR = A.AUFNR
INNER JOIN SAPSR3.AUFK O ON A.AUFNR = O.AUFNR
WHERE A.GSTRI >= '${fromDateSap}' AND O.WERKS LIKE 'PB%'
  AND P.AMEIN IN ('KG', 'KGM')
GROUP BY A.GSTRI, O.WERKS, P.MATNR, M.MAKTX
`;

/** Materiales de empaque (bolsas, etiquetas, etc.). */
export const buildFactMaterialesEmpaqueQuery = (fromDateSap: string): string => `
SELECT
    CONVERT(DATE, A.GSTRI, 112) AS "Fecha",
    O.WERKS AS "Codigo_Planta",
    R.MATNR AS "Codigo_Material",
    M.MAKTX AS "Descripcion_Material",
    CAST(SUM(R.ENMNG) AS DECIMAL(18,0)) AS "Cantidad_Consumida",
    R.MEINS AS "Unidad"
FROM SAPSR3.RESB R
INNER JOIN SAPSR3.MAKT M ON R.MATNR = M.MATNR AND M.SPRAS = 'S'
INNER JOIN SAPSR3.AFKO A ON R.AUFNR = A.AUFNR
INNER JOIN SAPSR3.AUFK O ON A.AUFNR = O.AUFNR
WHERE A.GSTRI >= '${fromDateSap}'
  AND (R.MATNR LIKE '%110%' OR M.MAKTX LIKE '%BOLSA%' OR M.MAKTX LIKE '%ETIQUETA%') AND O.WERKS LIKE 'PB%'
GROUP BY A.GSTRI, O.WERKS, R.MATNR, M.MAKTX, R.MEINS
`;
