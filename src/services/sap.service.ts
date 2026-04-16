import { config } from "../config";
import {
  buildDimOrdenesQuery,
  buildFactConsumosQuery,
  buildFactProduccionQuery,
  buildKpiProdCostosQuery,
  buildKpiProdEficienciaQuery,
  buildKpiProdLogisticaQuery,
  buildOrdenesProduccionRangoQuery,
  SYBASE_QUERIES
} from "../queries/sybase.queries";
import { logger } from "../utils/logger";

export type SapRecord = Record<string, unknown>;

export class SapService {
  public async fetchDimOrdenes(from: string): Promise<SapRecord[]> {
    const fromDate = this.parseInputDate(from);
    const fromDateSap = this.toSapDate(fromDate);
    const query = buildDimOrdenesQuery(fromDateSap);

    logger.info(
      { from, fromDateSap },
      "Consultando DIM_ORDENES por fecha de creación en SAP Sybase"
    );

    return this.executeSybaseQuery(query);
  }

  public async fetchFactConsumos(): Promise<SapRecord[]> {
    const query = buildFactConsumosQuery();

    logger.info("Consultando FACT_CONSUMOS en SAP Sybase");

    return this.executeSybaseQuery(query);
  }

  public async fetchFactProduccion(from: string): Promise<SapRecord[]> {
    const fromDate = this.parseInputDate(from);
    const fromDateSap = this.toSapDate(fromDate);
    const query = buildFactProduccionQuery(fromDateSap);

    logger.info(
      { from, fromDateSap },
      "Consultando FACT_PRODUCCION por fecha de creación en SAP Sybase"
    );

    return this.executeSybaseQuery(query);
  }

  public async fetchKpiProdCostos(from: string): Promise<SapRecord[]> {
    const fromDate = this.parseInputDate(from);
    const fromDateSap = this.toSapDate(fromDate);
    const query = buildKpiProdCostosQuery(fromDateSap);

    logger.info(
      { from, fromDateSap },
      "Consultando KPI_PROD_COSTOS por fecha de creación en SAP Sybase"
    );

    return this.executeSybaseQuery(query);
  }

  public async fetchKpiProdEficiencia(from: string): Promise<SapRecord[]> {
    const fromDate = this.parseInputDate(from);
    const fromDateSap = this.toSapDate(fromDate);
    const query = buildKpiProdEficienciaQuery(fromDateSap);

    logger.info(
      { from, fromDateSap },
      "Consultando KPI_PROD_EFICIENCIA por fecha de trabajo en SAP Sybase"
    );

    return this.executeSybaseQuery(query);
  }

  public async fetchKpiProdLogistica(from: string): Promise<SapRecord[]> {
    const fromDate = this.parseInputDate(from);
    const fromDateSap = this.toSapDate(fromDate);
    const query = buildKpiProdLogisticaQuery(fromDateSap);

    logger.info(
      { from, fromDateSap },
      "Consultando KPI_PROD_LOGISTICA por fecha de creacion en SAP Sybase"
    );

    return this.executeSybaseQuery(query);
  }

  public async fetchOrdenesProduccionByRango(
    from: string,
    to: string,
    werks?: string
  ): Promise<SapRecord[]> {
    const fromDate = this.parseInputDate(from);
    const toDate = this.parseInputDate(to);
    if (fromDate > toDate) {
      throw new Error("Rango inválido: 'desde' debe ser menor o igual a 'hasta'.");
    }

    let sanitizedWerks: string | undefined;
    if (werks && werks.trim()) {
      sanitizedWerks = werks.trim().toUpperCase();
    }

    if (sanitizedWerks && !/^[A-Z0-9]{1,10}$/.test(sanitizedWerks)) {
      throw new Error(
        "WERKS inválido. Solo se permiten letras/números, máximo 10 caracteres."
      );
    }

    const fromDateSap = this.toSapDate(fromDate);
    const toDateSap = this.toSapDate(toDate);
    const query = buildOrdenesProduccionRangoQuery(
      fromDateSap,
      toDateSap,
      sanitizedWerks
    );

    logger.info(
      { from, to, werks: sanitizedWerks, fromDateSap, toDateSap },
      "Consultando ordenes de producción por rango de fechas en SAP Sybase"
    );

    return this.executeSybaseQuery(query);
  }

  public async fetchData(): Promise<SapRecord[]> {
    try {
      logger.info(
        { mode: config.sap.sourceMode },
        "Iniciando extracción de datos desde SAP"
      );

      if (config.sap.sourceMode === "rfc") {
        return await this.fetchViaRfc();
      }

      if (config.sap.sourceMode === "sybase") {
        return await this.fetchViaSybase();
      }

      return await this.fetchViaRest();
    } catch (error) {
      logger.error({ err: error }, "Error en extracción SAP");
      throw error;
    }
  }

  private async fetchViaRfc(): Promise<SapRecord[]> {
    /**
     * Punto de integración RFC.
     * Aquí puedes usar node-rfc:
     * 1) Instanciar el cliente con parámetros de config.sap.rfc.
     * 2) client.open()
     * 3) client.call("Z_FUNCTION_MODULE", {...})
     * 4) Transformar resultado al array final.
     * 5) client.close()
     */
    logger.warn(
      "Modo RFC seleccionado, pero la integración real con node-rfc aún no fue implementada."
    );
    return [];
  }

  private async fetchViaRest(): Promise<SapRecord[]> {
    const { baseUrl, endpoint, apiKey } = config.sap.rest;
    if (!baseUrl) {
      logger.warn(
        "SAP_BASE_URL no está configurado. Se omite extracción REST y se retorna lote vacío."
      );
      return [];
    }

    const url = `${baseUrl.replace(/\/$/, "")}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(config.sap.timeoutMs)
    });

    if (!response.ok) {
      throw new Error(
        `Fallo SAP REST: status=${response.status} ${response.statusText}`
      );
    }

    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) {
      throw new Error(
        "Respuesta SAP REST inválida: se esperaba un arreglo de registros."
      );
    }

    logger.info({ records: payload.length }, "Extracción SAP completada");
    return payload as SapRecord[];
  }

  private async fetchViaSybase(): Promise<SapRecord[]> {
    return this.executeSybaseQuery(SYBASE_QUERIES.fetchOrdenesProduccion);
  }

  private async executeSybaseQuery(query: string): Promise<SapRecord[]> {
    const { connectionMode } = config.sap.sybase;
    if (connectionMode === "jdbc") {
      try {
        return await this.executeSybaseQueryJdbc(query);
      } catch (error) {
        const isJdbcMissingModule =
          error instanceof Error &&
          error.message.includes("Cannot find module 'jdbc'");

        if (!isJdbcMissingModule) {
          throw error;
        }

        logger.warn(
          { err: error },
          "JDBC no disponible, se intenta fallback a conexion ODBC"
        );
        return this.executeSybaseQueryOdbc(query);
      }
    }

    return this.executeSybaseQueryOdbc(query);
  }

  private async executeSybaseQueryOdbc(query: string): Promise<SapRecord[]> {
    const { dsn, driver, server, port, database, user, password } = config.sap.sybase;

    if (!user || !password) {
      throw new Error("Faltan parámetros de conexión Sybase (user/password).");
    }

    if (!dsn && (!driver || !server)) {
      throw new Error(
        "Faltan parámetros de conexión Sybase. Define SYBASE_DSN o bien SYBASE_DRIVER y SYBASE_SERVER."
      );
    }

    let connection: {
      query: (sql: string) => Promise<unknown[]>;
      close: () => Promise<void>;
    } | null = null;

    try {
      const odbcModule = await import("odbc");
      const connectionString = dsn
        ? [`DSN=${dsn}`, `UID=${user}`, `PWD=${password}`].join(";")
        : [
            `DRIVER=${driver}`,
            `Server=${server}`,
            `Port=${port}`,
            database ? `Database=${database}` : "",
            `UID=${user}`,
            `PWD=${password}`
          ]
            .filter(Boolean)
            .join(";");

      connection = (await odbcModule.connect(connectionString)) as {
        query: (sql: string) => Promise<unknown[]>;
        close: () => Promise<void>;
      };

      const rows = await connection.query(query);
      logger.info(
        { records: Array.isArray(rows) ? rows.length : 0 },
        "Consulta Sybase completada"
      );
      return (rows as SapRecord[]) ?? [];
    } catch (error) {
      logger.error({ err: error }, "Error consultando SAP Sybase por ODBC");
      const errAny = error as { message?: string; odbcErrors?: { message?: string }[] };
      const detail = errAny.odbcErrors?.map((e) => e.message?.trim()).filter(Boolean).join(" ");
      if (detail) {
        throw new Error(`${errAny.message ?? "ODBC"}: ${detail}`);
      }
      throw error;
    } finally {
      if (connection) {
        await connection.close();
      }
    }
  }

  private async executeSybaseQueryJdbc(query: string): Promise<SapRecord[]> {
    const { jdbcUrl, jdbcClassName, jdbcDriverPath, user, password } =
      config.sap.sybase;
    if (!jdbcUrl || !jdbcDriverPath || !user || !password) {
      throw new Error(
        "Para modo JDBC define SYBASE_JDBC_URL, SYBASE_JDBC_DRIVER_PATH, SYBASE_UID y SYBASE_PWD."
      );
    }

    try {
      // Carga opcional para no forzar dependencia nativa JDBC en runtime ODBC.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const JDBC = require("jdbc");
      // Algunas versiones de `jdbc` exponen jinst en un módulo aparte.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const jinstModule = require("jdbc/lib/jinst");
      const jinst = (JDBC.jinst ?? jinstModule) as {
        isJvmCreated: () => boolean;
        addOption: (opt: string) => void;
        setupClasspath: (paths: string[]) => void;
      };

      if (!jinst.isJvmCreated()) {
        if (config.sap.sybase.jvmPath) {
          jinst.addOption(`-Djava.library.path=${config.sap.sybase.jvmPath}`);
        }
        jinst.setupClasspath([jdbcDriverPath]);
      }

      const db = new JDBC({
        url: jdbcUrl,
        drivername: jdbcClassName,
        minpoolsize: 1,
        maxpoolsize: 1,
        properties: {
          user,
          password
        }
      });

      const initialized = await new Promise<void>((resolve, reject) => {
        db.initialize((err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
      void initialized;

      const rows = await new Promise<unknown[]>((resolve, reject) => {
        db.reserve((err: Error | null, connObj: any) => {
          if (err) {
            reject(err);
            return;
          }
          const conn = connObj.conn;
          conn.createStatement((stmtErr: Error | null, statement: any) => {
            if (stmtErr) {
              db.release(connObj, () => undefined);
              reject(stmtErr);
              return;
            }
            statement.executeQuery(query, (queryErr: Error | null, resultSet: any) => {
              if (queryErr) {
                db.release(connObj, () => undefined);
                reject(queryErr);
                return;
              }
              resultSet.toObjArray((arrErr: Error | null, arr: unknown[]) => {
                db.release(connObj, () => undefined);
                if (arrErr) reject(arrErr);
                else resolve(arr ?? []);
              });
            });
          });
        });
      });

      logger.info(
        { records: Array.isArray(rows) ? rows.length : 0 },
        "Consulta Sybase completada por JDBC"
      );
      return (rows as SapRecord[]) ?? [];
    } catch (error) {
      logger.error({ err: error }, "Error consultando SAP Sybase por JDBC");
      if (
        error instanceof Error &&
        error.message.includes("Cannot find module 'jdbc'")
      ) {
        throw error;
      }
      const message =
        error instanceof Error ? error.message : "Error desconocido JDBC";
      throw new Error(`Fallo JDBC Sybase: ${message}`);
    }
  }

  private toSapDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  }

  private parseInputDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error("Formato de fecha inválido. Usa YYYY-MM-DD.");
    }

    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Fecha inválida: ${value}`);
    }

    return date;
  }
}
