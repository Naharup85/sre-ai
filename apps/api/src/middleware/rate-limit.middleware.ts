import rateLimit from "express-rate-limit";
import { env } from "../config/env";

// Rate limiter for authentication endpoints: 30 requests per 15 minutes window
export const rateLimiter = (windowMs: number, max: number) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test",
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later",
  },
});
