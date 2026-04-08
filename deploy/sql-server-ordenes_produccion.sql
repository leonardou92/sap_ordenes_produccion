-- Tabla destino del sync (SapOrdenProduccionLine + estatus JEST/TJ02T).
-- DATETIME2(3): menos espacio que precisión máxima; ajusta si necesitas más decimales.
-- Opcional (Enterprise, tras pruebas de carga): compresión por página
--   ALTER TABLE dbo.ordenes_produccion REBUILD WITH (DATA_COMPRESSION = PAGE);

IF OBJECT_ID(N'ordenes_produccion', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ordenes_produccion] (
        [sap_line_id] VARCHAR(132) NOT NULL,
        [orden] VARCHAR(24) NOT NULL,
        [posicion] VARCHAR(12) NOT NULL,
        [stat_sistema] VARCHAR(16) NOT NULL,
        [cod_producto_principal] VARCHAR(40) NULL,
        [desc_producto_principal] VARCHAR(120) NULL,
        [cod_material_detalle] VARCHAR(40) NULL,
        [descripcion_material_detalle] VARCHAR(120) NULL,
        [estatus_breve] VARCHAR(64) NULL,
        [estatus_detallado] VARCHAR(200) NULL,
        [fecha_creacion] DATE NULL,
        [fecha_inicio_plan] DATE NULL,
        [fecha_fin_plan] DATE NULL,
        [fecha_inicio_real] DATE NULL,
        [fecha_fin_real] DATE NULL,
        [cant_planeada] DECIMAL(18, 6) NULL,
        [cant_producida_real] DECIMAL(18, 6) NULL,
        [unidad_medida] VARCHAR(12) NULL,
        [tipo_orden] VARCHAR(80) NULL,
        [synced_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_sap_ord_synced] DEFAULT SYSUTCDATETIME(),
        [updated_at] DATETIME2(3) NOT NULL CONSTRAINT [DF_sap_ord_updated] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_ordenes_produccion] PRIMARY KEY CLUSTERED ([sap_line_id])
    );

    CREATE NONCLUSTERED INDEX [ix_sap_ord_line_orden_pos]
        ON [dbo].[ordenes_produccion] ([orden] ASC, [posicion] ASC)
        INCLUDE ([stat_sistema], [fecha_creacion], [estatus_breve]);

    CREATE NONCLUSTERED INDEX [ix_sap_ord_line_fecha_creacion]
        ON [dbo].[ordenes_produccion] ([fecha_creacion] ASC)
        INCLUDE ([orden], [posicion], [estatus_breve]);

    CREATE NONCLUSTERED INDEX [ix_sap_ord_line_stat]
        ON [dbo].[ordenes_produccion] ([stat_sistema] ASC);

    CREATE NONCLUSTERED INDEX [ix_sap_ord_line_estatus_breve]
        ON [dbo].[ordenes_produccion] ([estatus_breve] ASC)
        WHERE [estatus_breve] IS NOT NULL;
END
