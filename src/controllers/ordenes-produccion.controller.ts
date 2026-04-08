import { Request, Response } from "express";
import { SapService } from "../services/sap.service";
import { logger } from "../utils/logger";
import { serializeError } from "../utils/serialize-error";

const sapService = new SapService();

export const getOrdenesProduccionPorRango = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const desde = String(req.query.desde ?? "");
    const hasta = String(req.query.hasta ?? "");
    const werks = req.query.werks ? String(req.query.werks) : undefined;

    if (!desde || !hasta) {
      res.status(400).json({
        ok: false,
        msg: "Parámetros inválidos. Debes enviar desde y hasta (YYYY-MM-DD).",
        requestId: req.requestId
      });
      return;
    }

    const data = await sapService.fetchOrdenesProduccionByRango(
      desde,
      hasta,
      werks
    );
    res.status(200).json({ ok: true, data, requestId: req.requestId });
  } catch (error) {
    logger.error(
      { err: serializeError(error), requestId: req.requestId },
      "Error obteniendo ordenes de produccion por rango"
    );
    const statusCode =
      error instanceof Error &&
      (error.message.includes("inválido") ||
        error.message.includes("invalido") ||
        error.message.includes("Formato de fecha") ||
        error.message.includes("Faltan parámetros de conexión"))
        ? 400
        : 500;
    res.status(statusCode).json({
      ok: false,
      msg: error instanceof Error ? error.message : "Error interno del servidor",
      requestId: req.requestId
    });
  }
};
