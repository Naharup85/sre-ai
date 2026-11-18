import winston from "winston";
import { AsyncLocalStorage } from "node:async_hooks";
import { env } from "./env";

export interface RequestContext {
  requestId: string;
}

export const requestStorage = new AsyncLocalStorage<RequestContext>();

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "jwt",
  "authorization",
  "cookie",
  "set-cookie",
  "secret",
  "jwt_secret",
  "confirmpassword",
  "confirm_password",
]);

export function redactSensitive(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    // Redact bearer tokens in strings like "Bearer eyJhbGci..."
    if (/^Bearer\s+.+$/i.test(value)) {
      return "Bearer [REDACTED]";
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item));
  }

  if (typeof value === "object") {
    const redactedObj: Record<string | symbol, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");
      if (
        SENSITIVE_KEYS.has(normalizedKey) ||
        key.toLowerCase().includes("password") ||
        key.toLowerCase().includes("secret") ||
        key.toLowerCase().includes("token")
      ) {
        redactedObj[key] = "[REDACTED]";
      } else {
        redactedObj[key] = redactSensitive(val);
      }
    }

    // Preserve Symbol properties used internally by Winston and logform (e.g. Symbol(level), Symbol(message))
    for (const sym of Object.getOwnPropertySymbols(value)) {
      redactedObj[sym] = (value as Record<symbol, unknown>)[sym];
    }

    return redactedObj;
  }

  return value;
}

const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },
  colors: {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    debug: "blue",
  },
};

winston.addColors(customLevels.colors);

// Format to inject context and redact sensitive values
const contextAndRedactFormat = winston.format((info) => {
  const store = requestStorage.getStore();
  if (!info.requestId && store?.requestId) {
    info.requestId = store.requestId;
  }
  info.service = "sre-ai-api";
  return redactSensitive(info) as winston.Logform.TransformableInfo;
});

const devFormat = winston.format.combine(
  contextAndRedactFormat(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, requestId, ...meta } = info;
    const reqStr = requestId ? ` [${requestId}]` : "";
    const metaKeys = Object.keys(meta);
    const metaStr = metaKeys.length > 0 ? ` ${JSON.stringify(meta)}` : "";
    return `[${timestamp}] [${level}] [${service}]${reqStr}: ${message}${metaStr}`;
  }),
);

const prodFormat = winston.format.combine(
  contextAndRedactFormat(),
  winston.format.timestamp(),
  winston.format.json(),
);

const isProduction = env.NODE_ENV === "production";
const isTest = env.NODE_ENV === "test";

export const logger = winston.createLogger({
  levels: customLevels.levels,
  level: isProduction ? "info" : isTest ? "error" : "debug",
  transports: [
    new winston.transports.Console({
      format: isProduction ? prodFormat : devFormat,
      silent: isTest && !process.env.DEBUG_TESTS,
    }),
  ],
});
