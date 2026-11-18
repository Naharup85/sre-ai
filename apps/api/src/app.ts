import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { requestLogger } from "./middleware/logger";
import { errorHandler, notFoundHandler } from "./middleware/error";

const app = express();

// Middleware
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(express.json());
app.use(requestLogger);

// Health check
app.get("/api/v1/health", (_req, res) => {
  res.json({
    success: true,
    message: "SRE AI API is running",
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

export default app;
