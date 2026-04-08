import dotenv from "dotenv";

// .env manda sobre variables ya exportadas en el shell (cron tiene entorno mínimo).
dotenv.config({ override: true });

type SapSourceMode = "rfc" | "rest" | "sybase";

const normalizeApiBasePath = (value: string | undefined): string => {
  if (!value?.trim()) return "";
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

interface AppConfig {
  nodeEnv: string;
  logLevel: string;
  port: number;
  /** Prefijo HTTP (ej. /ordenes-produccion) para no chocar con otro backend en el mismo host/proxy */
  apiBasePath: string;
  syncTable: string;
  syncBatchSize: number;
  syncConflictKeys: string[];
  /** ERDAT desde (YYYY-MM-DD): ventana SAP [desde, hoy UTC] en cada corrida de sync. */
  syncErdatFrom: string;
  /** Opcional: filtro WERKS (centro), ej. PB00. */
  syncWerks: string | undefined;
  sap: {
    sourceMode: SapSourceMode;
    timeoutMs: number;
    rfc: {
      appServerHost: string;
      systemNumber: string;
      client: string;
      user: string;
      password: string;
      lang: string;
    };
    rest: {
      baseUrl: string;
      endpoint: string;
      apiKey: string;
    };
    sybase: {
      connectionMode: "odbc" | "jdbc";
      dsn: string;
      driver: string;
      server: string;
      port: number;
      database: string;
      user: string;
      password: string;
      jdbcUrl: string;
      jdbcClassName: string;
      jdbcDriverPath: string;
      jvmPath: string;
    };
  };
  db: {
    client: string;
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    ssl: boolean;
    encrypt: boolean;
    trustServerCertificate: boolean;
    poolMin: number;
    poolMax: number;
  };
}

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
};

const parseConflictKeys = (
  value: string | undefined,
  fallback: string
): string[] => {
  const trimmed = value?.trim();
  if (!trimmed) return [fallback];
  return trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

export const config: AppConfig = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  logLevel: process.env.LOG_LEVEL ?? "info",
  port: parseNumber(process.env.PORT, 3000),
  apiBasePath: normalizeApiBasePath(process.env.API_BASE_PATH),
  syncTable:
    process.env.SYNC_TABLE ?? "ordenes_produccion",
  syncBatchSize: parseNumber(process.env.SYNC_BATCH_SIZE, 500),
  syncConflictKeys: parseConflictKeys(
    process.env.SYNC_CONFLICT_KEYS,
    "sap_line_id"
  ),
  syncErdatFrom: (process.env.SYNC_ERDAT_FROM ?? "").trim(),
  syncWerks: process.env.SYNC_WERKS?.trim() || undefined,
  sap: {
    sourceMode: (process.env.SAP_SOURCE_MODE as SapSourceMode) ?? "rest",
    timeoutMs: parseNumber(process.env.SAP_TIMEOUT_MS, 30000),
    rfc: {
      appServerHost: process.env.SAP_APP_SERVER_HOST ?? "",
      systemNumber: process.env.SAP_SYSTEM_NUMBER ?? "00",
      client: process.env.SAP_CLIENT ?? "100",
      user: process.env.SAP_USER ?? "",
      password: process.env.SAP_PASSWORD ?? "",
      lang: process.env.SAP_LANG ?? "ES"
    },
    rest: {
      baseUrl: process.env.SAP_BASE_URL ?? "",
      endpoint: process.env.SAP_REST_ENDPOINT ?? "/api/v1/materiales",
      apiKey: process.env.SAP_API_KEY ?? ""
    },
    sybase: {
      connectionMode:
        (process.env.SYBASE_CONNECTION_MODE as "odbc" | "jdbc") ?? "odbc",
      dsn: process.env.SYBASE_DSN ?? "",
      driver: process.env.SYBASE_DRIVER ?? "{Adaptive Server Enterprise}",
      server: process.env.SYBASE_SERVER ?? "",
      port: parseNumber(process.env.SYBASE_PORT, 4901),
      database: process.env.SYBASE_DB ?? "",
      user: process.env.SYBASE_UID ?? "",
      password: process.env.SYBASE_PWD ?? "",
      jdbcUrl: process.env.SYBASE_JDBC_URL ?? "",
      jdbcClassName: process.env.SYBASE_JDBC_CLASS_NAME ?? "com.sybase.jdbc4.jdbc.SybDriver",
      jdbcDriverPath: process.env.SYBASE_JDBC_DRIVER_PATH ?? "",
      jvmPath: process.env.JVM_PATH ?? ""
    }
  },
  db: {
    client: process.env.DB_CLIENT ?? "mssql",
    host: process.env.DB_HOST ?? "localhost",
    port: parseNumber(process.env.DB_PORT, 1433),
    user: process.env.DB_USER ?? "sa",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "sap_sync",
    ssl: parseBoolean(process.env.DB_SSL, false),
    encrypt: parseBoolean(process.env.DB_ENCRYPT, false),
    trustServerCertificate: parseBoolean(
      process.env.DB_TRUST_SERVER_CERTIFICATE,
      true
    ),
    poolMin: parseNumber(process.env.DB_POOL_MIN, 2),
    poolMax: parseNumber(process.env.DB_POOL_MAX, 10)
  }
};
