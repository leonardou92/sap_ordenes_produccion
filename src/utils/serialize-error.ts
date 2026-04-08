/** Serializa errores para logs JSON (pino no expande bien algunos objetos nativos). */
export function serializeError(err: unknown): {
  name?: string;
  message: string;
  stack?: string;
} {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    const o = err as { message?: unknown; stack?: unknown; name?: unknown };
    return {
      name: typeof o.name === "string" ? o.name : undefined,
      message: String(o.message ?? err),
      stack: typeof o.stack === "string" ? o.stack : undefined
    };
  }
  return { message: String(err) };
}
