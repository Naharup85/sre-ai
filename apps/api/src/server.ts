import app from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";

const server = app.listen(env.PORT, () => {
  logger.info(
    `SRE AI API running on http://localhost:${env.PORT} [${env.NODE_ENV}]`,
    {
      port: env.PORT,
      environment: env.NODE_ENV,
    },
  );
});

function handleShutdown(signal: string) {
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);
  server.close(() => {
    logger.info("HTTP server closed.");
    process.exit(0);
  });

  // Force shutdown if taking longer than 10s
  setTimeout(() => {
    logger.error("Forced shutdown due to timeout.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

export default server;
