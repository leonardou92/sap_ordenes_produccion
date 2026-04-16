import { config } from "./config";

const SAFE_SQL_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertSafeIdent(name: string, label: string, errors: string[]): void {
  if (!SAFE_SQL_IDENT.test(name)) {
    errors.push(`${label} inválido (solo letras, números y _; debe empezar con letra o _): ${name}`);
  }
}

/** Validación para `npm run start` / sync por cron. */
export function collectSyncConfigErrors(): string[] {
  const errors: string[] = [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.syncFechaInicio)) {
    errors.push(
      "SYNC_FECHA_INICIO debe ser YYYY-MM-DD (obligatorio para los sync por cron)."
    );
  }

  if (config.syncBatchSize < 1 || config.syncBatchSize > 20_000) {
    errors.push("SYNC_BATCH_SIZE debe estar entre 1 y 20000.");
  }
  if (config.batchSize < 1 || config.batchSize > 20_000) {
    errors.push(
      "BATCH_SIZE (lote compartido FACT/DIM) debe estar entre 1 y 20000."
    );
  }

  assertSafeIdent(config.syncTable, "SYNC_TABLE", errors);
  if (config.syncConflictKeys.length === 0) {
    errors.push("SYNC_CONFLICT_KEYS no puede estar vacío.");
  }
  for (const k of config.syncConflictKeys) {
    assertSafeIdent(k, "SYNC_CONFLICT_KEYS", errors);
  }
  const { user, password, host, database } = config.db;
  if (!host?.trim()) errors.push("DB_HOST es obligatorio.");
  if (!database?.trim()) errors.push("DB_NAME es obligatorio.");
  if (!user?.trim()) errors.push("DB_USER es obligatorio.");
  if (password === undefined || password === null) {
    errors.push("DB_PASSWORD debe estar definido (puede ser vacío solo si el motor lo permite).");
  }

  const sy = config.sap.sybase;
  if (!sy.user?.trim() || !sy.password?.trim()) {
    errors.push("SYBASE_UID y SYBASE_PWD son obligatorios para leer SAP.");
  }
  if (sy.connectionMode === "odbc") {
    const hasDsn = !!sy.dsn?.trim();
    const hasDirect =
      !!sy.driver?.trim() && !!sy.server?.trim();
    if (!hasDsn && !hasDirect) {
      errors.push(
        "ODBC: define SYBASE_DSN o bien SYBASE_DRIVER + SYBASE_SERVER."
      );
    }
  } else if (sy.connectionMode === "jdbc") {
    if (!sy.jdbcUrl?.trim() || !sy.jdbcDriverPath?.trim()) {
      errors.push("JDBC: SYBASE_JDBC_URL y SYBASE_JDBC_DRIVER_PATH son obligatorios.");
    }
  }

  return errors;
}

/** Validación para la API HTTP (consulta SAP + opcional ping BD). */
export function collectApiConfigErrors(): string[] {
  const errors: string[] = [];

  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    errors.push("PORT debe ser un entero entre 1 y 65535.");
  }

  const { user, password, host, database } = config.db;
  if (!host?.trim()) errors.push("DB_HOST es obligatorio.");
  if (!database?.trim()) errors.push("DB_NAME es obligatorio.");
  if (!user?.trim()) errors.push("DB_USER es obligatorio.");
  if (password === undefined || password === null) {
    errors.push("DB_PASSWORD debe estar definido.");
  }

  if (config.enableOrdenesConsultaApi) {
    const sy = config.sap.sybase;
    if (!sy.user?.trim() || !sy.password?.trim()) {
      errors.push(
        "SYBASE_UID y SYBASE_PWD son obligatorios cuando ENABLE_ORDENES_CONSULTA_API=true."
      );
    }
    if (sy.connectionMode === "odbc") {
      const hasDsn = !!sy.dsn?.trim();
      const hasDirect = !!sy.driver?.trim() && !!sy.server?.trim();
      if (!hasDsn && !hasDirect) {
        errors.push("ODBC: define SYBASE_DSN o SYBASE_DRIVER + SYBASE_SERVER.");
      }
    } else if (sy.connectionMode === "jdbc") {
      if (!sy.jdbcUrl?.trim() || !sy.jdbcDriverPath?.trim()) {
        errors.push(
          "JDBC: SYBASE_JDBC_URL y SYBASE_JDBC_DRIVER_PATH son obligatorios."
        );
      }
    }
  }

  return errors;
}

export function assertSyncConfig(): void {
  const errors = collectSyncConfigErrors();
  if (errors.length > 0) {
    throw new Error(`Configuración inválida:\n- ${errors.join("\n- ")}`);
  }
}

export function assertApiConfig(): void {
  const errors = collectApiConfigErrors();
  if (errors.length > 0) {
    throw new Error(`Configuración inválida:\n- ${errors.join("\n- ")}`);
  }
}
