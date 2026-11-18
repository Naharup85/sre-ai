import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { requestLogger } from "./middleware/logger";
import { errorHandler, notFoundHandler } from "./middleware/error";
import authRoutes from "./modules/auth/auth.routes";
import githubRoutes from "./modules/github/github.routes";
import ApiResponse from "./utils/response";

const app = express();

const baseUrl = "/api/v1";

// Global middleware
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(express.json());
app.use(requestLogger);
app.use(cookieParser());
// Health check
app.get(`${baseUrl}/health`, (_req, res) => {
  ApiResponse.success(res, null, "SRE AI API is running");
});

// Authentication routes
app.use(`${baseUrl}/auth`, authRoutes);

// GitHub App & Repository routes
app.use(`${baseUrl}/github`, githubRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

export default app;
