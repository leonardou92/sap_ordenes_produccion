-- Tabla destino: ordenes_produccion (antes sap_ordenes_produccion_lines). Sin borrar datos.
IF OBJECT_ID(N'dbo.sap_ordenes_produccion_lines', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.ordenes_produccion', N'U') IS NULL
BEGIN
    EXEC sp_rename N'dbo.sap_ordenes_produccion_lines', N'ordenes_produccion', N'OBJECT';
END
