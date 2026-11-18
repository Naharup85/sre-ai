import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../modules/auth/auth.service";
import ApiError from "../utils/errors";
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
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    } else if (req.cookies && typeof req.cookies.token === "string") {
      token = req.cookies.token.trim();
    }

    if (!token) {
      logger.warn(
        "Authentication failure: missing or malformed Authorization header",
      );
      return next(
        ApiError.unAuthorized("Authorization header with Bearer token is required"),
      );
    }

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
    return next(
      ApiError.unAuthorized("Invalid or expired authentication token"),
    );
  }
}
