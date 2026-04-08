-- Solo tablas de este proyecto. No toca el resto de objetos del servidor.
-- BD compartida ya con tablas: ver comentario al final de package.json / .env.example
-- (primera vez: db execute + migrate resolve; luego solo migrate deploy).
BEGIN TRY

BEGIN TRAN;

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC sp_executesql N'CREATE SCHEMA [dbo];';

IF OBJECT_ID(N'dbo.sync_logs', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[sync_logs] (
        [id] BIGINT NOT NULL IDENTITY(1,1),
        [source] NVARCHAR(1000) NOT NULL CONSTRAINT [sync_logs_source_df] DEFAULT 'SAP',
        [targetTable] NVARCHAR(1000) NOT NULL,
        [batchSize] INT NOT NULL,
        [totalProcessed] INT NOT NULL,
        [status] NVARCHAR(1000) NOT NULL,
        [errorMessage] NVARCHAR(1000),
        [startedAt] DATETIME2 NOT NULL CONSTRAINT [sync_logs_startedAt_df] DEFAULT CURRENT_TIMESTAMP,
        [finishedAt] DATETIME2,
        CONSTRAINT [sync_logs_pkey] PRIMARY KEY CLUSTERED ([id])
    );
END;

IF OBJECT_ID(N'dbo.sap_ordenes_produccion_lines', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[sap_ordenes_produccion_lines] (
        [sap_line_id] VARCHAR(132) NOT NULL,
        [orden] VARCHAR(24) NOT NULL,
        [posicion] VARCHAR(12) NOT NULL,
        [stat_sistema] VARCHAR(16) NOT NULL,
        [cod_producto_principal] VARCHAR(40),
        [desc_producto_principal] VARCHAR(120),
        [cod_material_detalle] VARCHAR(40),
        [descripcion_material_detalle] VARCHAR(120),
        [estatus_breve] VARCHAR(64),
        [estatus_detallado] VARCHAR(200),
        [fecha_creacion] DATE,
        [fecha_inicio_plan] DATE,
        [fecha_fin_plan] DATE,
        [fecha_inicio_real] DATE,
        [fecha_fin_real] DATE,
        [cant_planeada] DECIMAL(18,6),
        [cant_producida_real] DECIMAL(18,6),
        [unidad_medida] VARCHAR(12),
        [tipo_orden] VARCHAR(80),
        [synced_at] DATETIME2 NOT NULL CONSTRAINT [sap_ordenes_produccion_lines_synced_at_df] DEFAULT CURRENT_TIMESTAMP,
        [updated_at] DATETIME2 NOT NULL CONSTRAINT [sap_ordenes_produccion_lines_updated_at_df] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [sap_ordenes_produccion_lines_pkey] PRIMARY KEY CLUSTERED ([sap_line_id])
    );

    CREATE NONCLUSTERED INDEX [ix_sap_ord_line_orden_pos] ON [dbo].[sap_ordenes_produccion_lines]([orden], [posicion]);
    CREATE NONCLUSTERED INDEX [ix_sap_ord_line_fecha_creacion] ON [dbo].[sap_ordenes_produccion_lines]([fecha_creacion]);
    CREATE NONCLUSTERED INDEX [ix_sap_ord_line_stat] ON [dbo].[sap_ordenes_produccion_lines]([stat_sistema]);
    CREATE NONCLUSTERED INDEX [ix_sap_ord_line_estatus_breve] ON [dbo].[sap_ordenes_produccion_lines]([estatus_breve]);
END
ELSE
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes i
        INNER JOIN sys.tables t ON i.object_id = t.object_id
        WHERE t.name = N'sap_ordenes_produccion_lines' AND SCHEMA_NAME(t.schema_id) = N'dbo'
          AND i.name = N'ix_sap_ord_line_orden_pos'
    )
        CREATE NONCLUSTERED INDEX [ix_sap_ord_line_orden_pos] ON [dbo].[sap_ordenes_produccion_lines]([orden], [posicion]);

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes i
        INNER JOIN sys.tables t ON i.object_id = t.object_id
        WHERE t.name = N'sap_ordenes_produccion_lines' AND SCHEMA_NAME(t.schema_id) = N'dbo'
          AND i.name = N'ix_sap_ord_line_fecha_creacion'
    )
        CREATE NONCLUSTERED INDEX [ix_sap_ord_line_fecha_creacion] ON [dbo].[sap_ordenes_produccion_lines]([fecha_creacion]);

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes i
        INNER JOIN sys.tables t ON i.object_id = t.object_id
        WHERE t.name = N'sap_ordenes_produccion_lines' AND SCHEMA_NAME(t.schema_id) = N'dbo'
          AND i.name = N'ix_sap_ord_line_stat'
    )
        CREATE NONCLUSTERED INDEX [ix_sap_ord_line_stat] ON [dbo].[sap_ordenes_produccion_lines]([stat_sistema]);

    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes i
        INNER JOIN sys.tables t ON i.object_id = t.object_id
        WHERE t.name = N'sap_ordenes_produccion_lines' AND SCHEMA_NAME(t.schema_id) = N'dbo'
          AND i.name = N'ix_sap_ord_line_estatus_breve'
    )
        CREATE NONCLUSTERED INDEX [ix_sap_ord_line_estatus_breve] ON [dbo].[sap_ordenes_produccion_lines]([estatus_breve]);
END;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
