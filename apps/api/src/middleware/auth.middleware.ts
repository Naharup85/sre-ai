import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../modules/auth/auth.service";
import { logger } from "../config/logger";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn(
      "Authentication failure: missing or malformed Authorization header",
    );
    res.status(401).json({
      success: false,
      message: "Authorization header with Bearer token is required",
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    logger.warn("Authentication failure: empty Bearer token");
    res.status(401).json({
      success: false,
      message: "Authentication token is required",
    });
    return;
  }

  try {
    const payload = await verifyToken(token);
    req.user = {
      id: payload.userId,
      email: payload.email,
    };
    next();
  } catch (error: unknown) {
    const errMessage =
      error instanceof Error ? error.message : "Token validation failed";
    logger.warn("Authentication failure: token verification failed", {
      reason: errMessage,
    });
    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }
}
