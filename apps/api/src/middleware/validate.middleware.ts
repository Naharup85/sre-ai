import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { env } from "../config/env";

export type ValidationSource = "body" | "query" | "params";

export function validate(
  schema: ZodSchema,
  source: ValidationSource = "body",
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parseResult = schema.safeParse(req[source]);
    if (!parseResult.success) {
      const firstError =
        parseResult.error.errors[0]?.message || "Invalid input";

      // If browser navigation on callback with invalid parameters, redirect to frontend settings
      if (
        source === "query" &&
        req.path.includes("callback") &&
        req.accepts("html") &&
        !req.xhr &&
        !req.headers.accept?.includes("application/json")
      ) {
        return res.redirect(
          `${env.FRONTEND_URL}/settings?error=${encodeURIComponent(firstError)}`,
        );
      }

      res.status(400).json({
        success: false,
        message: firstError,
        errors: parseResult.error.flatten().fieldErrors,
      });
      return;
    }

    req[source] = parseResult.data;
    next();
  };
}

export const validateBody = (schema: ZodSchema) => validate(schema, "body");
export const validateQuery = (schema: ZodSchema) => validate(schema, "query");
export const validateParams = (schema: ZodSchema) => validate(schema, "params");
