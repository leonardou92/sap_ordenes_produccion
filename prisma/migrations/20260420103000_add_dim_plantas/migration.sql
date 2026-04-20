-- Catálogo de plantas SAP (T001W) para códigos PB.

IF OBJECT_ID(N'[dbo].[dim_plantas]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[dim_plantas] (
    [codigo_planta]      VARCHAR(12)    NOT NULL,
    [nombre_planta]      VARCHAR(120)   NULL,
    [sociedad_codigo]    VARCHAR(12)    NULL,
    [centro_valoracion]  VARCHAR(12)    NULL,
    [ciudad]             VARCHAR(80)    NULL,
    [pais]               VARCHAR(6)     NULL,
    [synced_at]          DATETIME2(3)   NOT NULL CONSTRAINT [DF_dim_plantas_synced_at] DEFAULT (SYSUTCDATETIME()),
    [updated_at]         DATETIME2(3)   NOT NULL CONSTRAINT [DF_dim_plantas_updated_at] DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT [PK_dim_plantas] PRIMARY KEY CLUSTERED ([codigo_planta] ASC)
  );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_dim_plantas_nombre' AND object_id = OBJECT_ID(N'[dbo].[dim_plantas]'))
BEGIN
  CREATE NONCLUSTERED INDEX [ix_dim_plantas_nombre] ON [dbo].[dim_plantas]([nombre_planta]);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_dim_plantas_sociedad' AND object_id = OBJECT_ID(N'[dbo].[dim_plantas]'))
BEGIN
  CREATE NONCLUSTERED INDEX [ix_dim_plantas_sociedad] ON [dbo].[dim_plantas]([sociedad_codigo]);
END;
