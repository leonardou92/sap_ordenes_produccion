-- Tablas reporte diario PB (Power BI): resumen, recepción, despiece, empaque.

IF OBJECT_ID(N'[dbo].[fact_produccion_resumen]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[fact_produccion_resumen] (
    [fecha]              DATE           NOT NULL,
    [codigo_planta]      VARCHAR(12)    NOT NULL,
    [nombre_planta]      VARCHAR(120)   NULL,
    [aves_procesadas]    DECIMAL(18, 0) NULL,
    [kg_planta_total]    DECIMAL(18, 2) NULL,
    [kg_granja_total]    DECIMAL(18, 2) NULL,
    [dif_kg]             DECIMAL(18, 2) NULL,
    [porcentaje_merma]   DECIMAL(18, 2) NULL,
    [synced_at]          DATETIME2(3)   NOT NULL CONSTRAINT [DF_fpr_synced_at] DEFAULT (SYSUTCDATETIME()),
    [updated_at]         DATETIME2(3)   NOT NULL CONSTRAINT [DF_fpr_updated_at] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_fact_produccion_resumen] PRIMARY KEY CLUSTERED ([fecha] ASC, [codigo_planta] ASC)
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_fpr_fecha' AND object_id = OBJECT_ID(N'[dbo].[fact_produccion_resumen]'))
BEGIN
  CREATE NONCLUSTERED INDEX [ix_fpr_fecha] ON [dbo].[fact_produccion_resumen]([fecha]);
END;

IF OBJECT_ID(N'[dbo].[fact_recepcion_camiones]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[fact_recepcion_camiones] (
    [fecha]                DATE           NOT NULL,
    [codigo_planta]        VARCHAR(12)    NOT NULL,
    [placa_lote]           VARCHAR(40)    NOT NULL,
    [granja_descripcion]   VARCHAR(200)   NULL,
    [kg_granja]            DECIMAL(18, 2) NULL,
    [kg_planta]            DECIMAL(18, 2) NULL,
    [aves_recibidas]       DECIMAL(18, 0) NULL,
    [dif_kg]               DECIMAL(18, 2) NULL,
    [synced_at]            DATETIME2(3)   NOT NULL CONSTRAINT [DF_frc_synced_at] DEFAULT (SYSUTCDATETIME()),
    [updated_at]           DATETIME2(3)   NOT NULL CONSTRAINT [DF_frc_updated_at] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_fact_recepcion_camiones] PRIMARY KEY CLUSTERED ([fecha] ASC, [codigo_planta] ASC, [placa_lote] ASC)
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_frc_fecha' AND object_id = OBJECT_ID(N'[dbo].[fact_recepcion_camiones]'))
BEGIN
  CREATE NONCLUSTERED INDEX [ix_frc_fecha] ON [dbo].[fact_recepcion_camiones]([fecha]);
END;

IF OBJECT_ID(N'[dbo].[fact_produccion_detalle_reporte]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[fact_produccion_detalle_reporte] (
    [fecha]            DATE           NOT NULL,
    [codigo_planta]    VARCHAR(12)    NOT NULL,
    [codigo_producto]  VARCHAR(40)    NOT NULL,
    [referencia]       VARCHAR(200)   NULL,
    [kg_producidos]    DECIMAL(18, 2) NULL,
    [synced_at]        DATETIME2(3)   NOT NULL CONSTRAINT [DF_fpdr_synced_at] DEFAULT (SYSUTCDATETIME()),
    [updated_at]       DATETIME2(3)   NOT NULL CONSTRAINT [DF_fpdr_updated_at] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_fact_produccion_detalle_reporte] PRIMARY KEY CLUSTERED ([fecha] ASC, [codigo_planta] ASC, [codigo_producto] ASC)
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_fpdr_fecha' AND object_id = OBJECT_ID(N'[dbo].[fact_produccion_detalle_reporte]'))
BEGIN
  CREATE NONCLUSTERED INDEX [ix_fpdr_fecha] ON [dbo].[fact_produccion_detalle_reporte]([fecha]);
END;

IF OBJECT_ID(N'[dbo].[fact_materiales_empaque]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[fact_materiales_empaque] (
    [fecha]                 DATE           NOT NULL,
    [codigo_planta]         VARCHAR(12)    NOT NULL,
    [codigo_material]       VARCHAR(40)    NOT NULL,
    [descripcion_material]  VARCHAR(200)   NULL,
    [cantidad_consumida]    DECIMAL(18, 0) NULL,
    [unidad]                VARCHAR(12)    NOT NULL,
    [synced_at]             DATETIME2(3)   NOT NULL CONSTRAINT [DF_fme_synced_at] DEFAULT (SYSUTCDATETIME()),
    [updated_at]            DATETIME2(3)   NOT NULL CONSTRAINT [DF_fme_updated_at] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_fact_materiales_empaque] PRIMARY KEY CLUSTERED ([fecha] ASC, [codigo_planta] ASC, [codigo_material] ASC, [unidad] ASC)
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_fme_fecha' AND object_id = OBJECT_ID(N'[dbo].[fact_materiales_empaque]'))
BEGIN
  CREATE NONCLUSTERED INDEX [ix_fme_fecha] ON [dbo].[fact_materiales_empaque]([fecha]);
END;
