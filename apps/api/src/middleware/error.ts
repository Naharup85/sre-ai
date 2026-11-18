import type { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";
import { env } from "../config/env";
import ApiError from "../utils/errors";

export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const isApiError = err instanceof ApiError;
  const statusCode = isApiError ? err.statusCode : 500;

  logger.error(`Unhandled error: ${err.message}`, {
    error: {
      name: err.name,
      message: err.message,
      stack: env.NODE_ENV === "production" ? undefined : err.stack,
    },
    method: req.method,
    url: req.originalUrl || req.url,
    requestId: req.id,
  });

  const message =
    env.NODE_ENV === "production" && statusCode === 500
      ? "Internal server error"
      : err.message;

  const errors = isApiError ? (err as ApiError).errors : undefined;

  res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: "Not found",
  });
}
