import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { logger, requestStorage } from "../config/logger";

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const incomingId = req.headers["x-request-id"];
  const requestId =
    typeof incomingId === "string" && incomingId.trim().length > 0
      ? incomingId.trim()
      : crypto.randomUUID();

  req.id = requestId;
  res.setHeader("X-Request-Id", requestId);

  requestStorage.run({ requestId }, () => {
    const startTime = process.hrtime.bigint();

    res.on("finish", () => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      // Never log sensitive bodies or credentials.
      // Log HTTP method, URL, status, duration, and client details.
      logger.http(
        `${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${durationMs.toFixed(2)}ms`,
        {
          method: req.method,
          url: req.originalUrl || req.url,
          statusCode: res.statusCode,
          durationMs: Number(durationMs.toFixed(2)),
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.get("user-agent") || "unknown",
          requestId,
        },
      );
    });

    next();
  });
}
