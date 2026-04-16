IF OBJECT_ID(N'[dbo].[fact_produccion]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[fact_produccion] (
    [fact_produccion_id] VARCHAR(140)   NOT NULL,
    [orden_id]           VARCHAR(24)    NOT NULL,
    [centro_id]          VARCHAR(12)    NULL,
    [producto_desc]      VARCHAR(200)   NULL,
    [fecha_creacion]     DATE           NULL,
    [fecha_inicio_plan]  DATE           NULL,
    [fecha_fin_plan]     DATE           NULL,
    [fecha_fin_real]     DATE           NULL,
    [cant_planificada]   DECIMAL(18, 3) NULL,
    [cant_real]          DECIMAL(18, 3) NULL,
    [unidad_medida]      VARCHAR(12)    NULL,
    [synced_at]          DATETIME2(3)   NOT NULL CONSTRAINT [DF_fact_produccion_synced_at] DEFAULT (SYSUTCDATETIME()),
    [updated_at]         DATETIME2(3)   NOT NULL CONSTRAINT [DF_fact_produccion_updated_at] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_fact_produccion] PRIMARY KEY CLUSTERED ([fact_produccion_id] ASC)
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_fact_produccion_orden_id' AND object_id = OBJECT_ID(N'[dbo].[fact_produccion]'))
BEGIN
  CREATE INDEX [ix_fact_produccion_orden_id]
    ON [dbo].[fact_produccion] ([orden_id]);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_fact_produccion_fecha_fin_real' AND object_id = OBJECT_ID(N'[dbo].[fact_produccion]'))
BEGIN
  CREATE INDEX [ix_fact_produccion_fecha_fin_real]
    ON [dbo].[fact_produccion] ([fecha_fin_real]);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_fact_produccion_centro_id' AND object_id = OBJECT_ID(N'[dbo].[fact_produccion]'))
BEGIN
  CREATE INDEX [ix_fact_produccion_centro_id]
    ON [dbo].[fact_produccion] ([centro_id]);
END;

IF OBJECT_ID(N'[dbo].[fact_consumos]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[fact_consumos] (
    [fact_consumo_id]     VARCHAR(180)   NOT NULL,
    [orden_id]            VARCHAR(24)    NOT NULL,
    [componente_desc]     VARCHAR(200)   NULL,
    [cant_necesaria]      DECIMAL(18, 3) NULL,
    [cant_consumida_real] DECIMAL(18, 3) NULL,
    [unidad_medida]       VARCHAR(12)    NULL,
    [desviacion_material] DECIMAL(18, 3) NULL,
    [synced_at]           DATETIME2(3)   NOT NULL CONSTRAINT [DF_fact_consumos_synced_at] DEFAULT (SYSUTCDATETIME()),
    [updated_at]          DATETIME2(3)   NOT NULL CONSTRAINT [DF_fact_consumos_updated_at] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_fact_consumos] PRIMARY KEY CLUSTERED ([fact_consumo_id] ASC)
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_fact_consumos_orden_id' AND object_id = OBJECT_ID(N'[dbo].[fact_consumos]'))
BEGIN
  CREATE INDEX [ix_fact_consumos_orden_id]
    ON [dbo].[fact_consumos] ([orden_id]);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_fact_consumos_desviacion' AND object_id = OBJECT_ID(N'[dbo].[fact_consumos]'))
BEGIN
  CREATE INDEX [ix_fact_consumos_desviacion]
    ON [dbo].[fact_consumos] ([desviacion_material]);
END;

IF OBJECT_ID(N'[dbo].[dim_ordenes]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[dim_ordenes] (
    [orden_id]        VARCHAR(24)  NOT NULL,
    [tipo_orden_desc] VARCHAR(120) NULL,
    [centro_desc]     VARCHAR(120) NULL,
    [estatus_actual]  VARCHAR(120) NULL,
    [synced_at]       DATETIME2(3) NOT NULL CONSTRAINT [DF_dim_ordenes_synced_at] DEFAULT (SYSUTCDATETIME()),
    [updated_at]      DATETIME2(3) NOT NULL CONSTRAINT [DF_dim_ordenes_updated_at] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_dim_ordenes] PRIMARY KEY CLUSTERED ([orden_id] ASC)
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_dim_ordenes_estatus_actual' AND object_id = OBJECT_ID(N'[dbo].[dim_ordenes]'))
BEGIN
  CREATE INDEX [ix_dim_ordenes_estatus_actual]
    ON [dbo].[dim_ordenes] ([estatus_actual]);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_dim_ordenes_centro_desc' AND object_id = OBJECT_ID(N'[dbo].[dim_ordenes]'))
BEGIN
  CREATE INDEX [ix_dim_ordenes_centro_desc]
    ON [dbo].[dim_ordenes] ([centro_desc]);
END;
