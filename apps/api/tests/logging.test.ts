import { describe, it, expect, vi } from "vitest";
import { request } from "./test-client";
import { mockDb } from "./mock-db";

vi.mock("../src/db", () => ({
  db: mockDb,
}));

import app from "../src/app";
import { logger, redactSensitive } from "../src/config/logger";

describe("Logging & Security Redaction", () => {
  it("should generate a unique X-Request-Id for incoming requests", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBeDefined();
    expect(response.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("should preserve client-supplied X-Request-Id header", async () => {
    const customReqId = "custom-trace-id-12345";
    const response = await request(app)
      .get("/api/v1/health")
      .set("X-Request-Id", customReqId);

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe(customReqId);
  });

  it("should redact sensitive fields in logged payloads", () => {
    const sensitivePayload = {
      name: "Test User",
      email: "test@example.com",
      password: "my-secret-password",
      passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$...",
      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      jwt: "secret.jwt.token",
      authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      cookie: "session=xyz123",
      secretKey: "supersecret",
      nested: {
        password: "nested-password",
        normal: "safe-value",
      },
      array: [
        { password: "arr-password", info: "visible" },
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      ],
    };

    const redacted = redactSensitive(sensitivePayload) as Record<string, any>;

    expect(redacted.name).toBe("Test User");
    expect(redacted.email).toBe("test@example.com");
    expect(redacted.password).toBe("[REDACTED]");
    expect(redacted.passwordHash).toBe("[REDACTED]");
    expect(redacted.token).toBe("[REDACTED]");
    expect(redacted.accessToken).toBe("[REDACTED]");
    expect(redacted.jwt).toBe("[REDACTED]");
    expect(redacted.authorization).toBe("[REDACTED]");
    expect(redacted.cookie).toBe("[REDACTED]");
    expect(redacted.secretKey).toBe("[REDACTED]");
    expect(redacted.nested.password).toBe("[REDACTED]");
    expect(redacted.nested.normal).toBe("safe-value");
    expect(redacted.array[0].password).toBe("[REDACTED]");
    expect(redacted.array[0].info).toBe("visible");
    expect(redacted.array[1]).toBe("Bearer [REDACTED]");
  });

  it("should record error logs when handling unexpected errors", async () => {
    const loggerSpy = vi.spyOn(logger, "error");

    // Route that does not exist returns 404, but let's test a trigger that causes error handler
    // We can test error handler directly or trigger via app error
    const testError = new Error("Test unhandled exception");
    const { errorHandler } = await import("../src/middleware/error");

    const mockReq = {
      method: "GET",
      url: "/api/v1/test-fail",
      id: "req-err-123",
    } as any;

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    const mockNext = vi.fn();

    errorHandler(testError, mockReq, mockRes, mockNext);

    expect(loggerSpy).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
      }),
    );

    loggerSpy.mockRestore();
  });
});
