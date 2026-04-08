import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const fromHeader = req.headers["x-request-id"];
  const id =
    typeof fromHeader === "string" && fromHeader.trim().length > 0
      ? fromHeader.trim().slice(0, 128)
      : randomUUID();
  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
}
