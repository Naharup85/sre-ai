import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { requestLogger } from "./middleware/logger";
import { errorHandler, notFoundHandler } from "./middleware/error";
import authRoutes from "./modules/auth/auth.routes";
import ApiResponse from "./utils/response";

const app = express();

// Global middleware
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
  ApiResponse.success(res, null, "SRE AI API is running");
});

// Authentication routes
app.use("/api/v1/auth", authRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

export default app;
