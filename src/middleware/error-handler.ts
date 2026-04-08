import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { serializeError } from "../utils/serialize-error";

/**
 * Debe registrarse como último middleware (después de rutas).
 * No filtra detalles internos al cliente; solo mensaje genérico en 500.
 */
export function errorHandlerMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (res.headersSent) {
    return;
  }

  logger.error(
    {
      err: serializeError(err),
      requestId: req.requestId,
      path: req.path,
      method: req.method
    },
    "Error no capturado en HTTP"
  );

  const status =
    err instanceof Error &&
    (err.message.includes("inválido") ||
      err.message.includes("invalido") ||
      err.message.includes("Formato de fecha") ||
      err.message.includes("Faltan parámetros"))
      ? 400
      : 500;

  const msg =
    status === 500
      ? "Error interno del servidor"
      : err instanceof Error
        ? err.message
        : "Solicitud inválida";

  res.status(status).json({ ok: false, msg, requestId: req.requestId });
}
