import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError =
        parseResult.error.errors[0]?.message || "Invalid input";
      res.status(400).json({
        success: false,
        message: firstError,
        errors: parseResult.error.flatten().fieldErrors,
      });
      return;
    }

    req.body = parseResult.data;
    next();
  };
}
