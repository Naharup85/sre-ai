import { describe, it, expect, beforeEach, vi } from "vitest";
import { request } from "./test-client";
import * as jose from "jose";
import { mockDb, mockUsersStore, resetMockUsers } from "./mock-db";

// Mock database
vi.mock("../src/db", () => ({
  db: mockDb,
}));

import app from "../src/app";
import { verifyPassword } from "../src/modules/auth/auth.service";
import { env } from "../src/config/env";

describe("Authentication Endpoints & Flows", () => {
  beforeEach(() => {
    resetMockUsers();
  });

  describe("Registration (POST /api/v1/auth/register)", () => {
    it("should successfully register a new user and return safe user info with access token", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Sachin",
          email: "sachin@example.com",
          password: "secure-password-123",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.name).toBe("Sachin");
      expect(response.body.data.user.email).toBe("sachin@example.com");
      expect(response.body.data.user.id).toBeDefined();
      // Crucial security requirement: password_hash must never be returned
      expect(response.body.data.user.passwordHash).toBeUndefined();
      expect(response.body.data.user.password_hash).toBeUndefined();
      expect(response.body.data.accessToken).toBeDefined();

      // Verify Argon2id password hashing in DB
      expect(mockUsersStore).toHaveLength(1);
      expect(mockUsersStore[0].passwordHash).toContain("$argon2id$");
      const isMatch = await verifyPassword(
        mockUsersStore[0].passwordHash,
        "secure-password-123",
      );
      expect(isMatch).toBe(true);
    });

    it("should normalize email address to lowercase and trimmed", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Sachin",
          email: "  SACHIN.upper@Example.COM  ",
          password: "secure-password-123",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.user.email).toBe("sachin.upper@example.com");
      expect(mockUsersStore[0].email).toBe("sachin.upper@example.com");
    });

    it("should return HTTP 409 Conflict when registering with an existing email", async () => {
      // First registration
      await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Sachin",
          email: "sachin@example.com",
          password: "secure-password-123",
        });

      // Second registration with same email
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Sachin Duplicate",
          email: "sachin@example.com",
          password: "another-password",
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("already registered");
    });

    it("should return HTTP 400 Bad Request for invalid email format", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Sachin",
          email: "not-an-email",
          password: "secure-password-123",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it("should return HTTP 400 Bad Request for missing required fields", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          email: "sachin@example.com",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should return HTTP 400 Bad Request for short password", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Sachin",
          email: "sachin@example.com",
          password: "short",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("Login (POST /api/v1/auth/login)", () => {
    beforeEach(async () => {
      // Register a test user
      await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Test User",
          email: "test@example.com",
          password: "valid-password-123",
        });
    });

    it("should successfully log in with valid credentials and return access token", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "test@example.com",
          password: "valid-password-123",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe("test@example.com");
      expect(response.body.data.user.passwordHash).toBeUndefined();
      expect(response.body.data.accessToken).toBeDefined();
    });

    it("should return generic HTTP 401 Unauthorized for incorrect password", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "test@example.com",
          password: "wrong-password",
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid email or password");
    });

    it("should return generic HTTP 401 Unauthorized for nonexistent email", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "some-password",
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid email or password");
    });

    it("should return HTTP 400 Bad Request for invalid input", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "not-an-email",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("Authentication & Protected Endpoints (GET /api/v1/auth/me)", () => {
    let validToken: string;
    let userId: string;

    beforeEach(async () => {
      const reg = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Auth User",
          email: "auth@example.com",
          password: "secure-auth-password",
        });

      validToken = reg.body.data.accessToken;
      userId = reg.body.data.user.id;
    });

    it("should access /api/v1/auth/me with valid Bearer token", async () => {
      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(userId);
      expect(response.body.data.user.email).toBe("auth@example.com");
      expect(response.body.data.user.passwordHash).toBeUndefined();
    });

    it("should return HTTP 401 Unauthorized when Authorization header is missing", async () => {
      const response = await request(app).get("/api/v1/auth/me");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Bearer token is required");
    });

    it("should return HTTP 401 Unauthorized for invalid JWT token", async () => {
      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", "Bearer invalid-token-string");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid or expired");
    });

    it("should return HTTP 401 Unauthorized for expired JWT token", async () => {
      // Create an expired token
      const secret = new TextEncoder().encode(env.JWT_SECRET);
      const expiredToken = await new jose.SignJWT({ email: "auth@example.com" })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setSubject(userId)
        .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
        .sign(secret);

      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid or expired");
    });
  });

  describe("Logout (POST /api/v1/auth/logout)", () => {
    it("should return HTTP 200 with successful logout message", async () => {
      const response = await request(app).post("/api/v1/auth/logout");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Logged out successfully");
    });
  });
});
