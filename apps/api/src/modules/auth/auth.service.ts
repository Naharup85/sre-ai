import * as jose from "jose";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema/users";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import ApiError from "../../utils/errors";
import type { RegisterInput, LoginInput } from "./auth.validation";

export { ApiError };

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SafeUser = User;

export interface AuthResult {
  user: User;
  accessToken: string;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB (OWASP recommendation)
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export async function generateToken(payload: {
  userId: string;
  email: string;
}): Promise<string> {
  const secretKey = new TextEncoder().encode(env.JWT_SECRET);
  return new jose.SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(secretKey);
}

export async function verifyToken(
  token: string,
): Promise<{ userId: string; email: string }> {
  const secretKey = new TextEncoder().encode(env.JWT_SECRET);
  const { payload } = await jose.jwtVerify(token, secretKey, {
    algorithms: ["HS256"],
  });

  if (!payload.sub) {
    throw ApiError.unAuthorized("Missing subject claim in token");
  }

  return {
    userId: payload.sub,
    email: payload.email as string,
  };
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResult> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // Check whether email already exists
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      logger.warn("Registration rejected: email already exists");
      throw ApiError.conflict("Email is already registered");
    }

    // Hash password with Argon2id
    const passwordHash = await hashPassword(input.password);

    // Insert user into database
    const [newUser] = await db
      .insert(users)
      .values({
        name: input.name.trim(),
        email: normalizedEmail,
        passwordHash,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    // Generate JWT access token
    const accessToken = await generateToken({
      userId: newUser.id,
      email: newUser.email,
    });

    logger.info("User registered successfully", { userId: newUser.id });

    return {
      user: newUser,
      accessToken,
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // Find user by normalized email
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        passwordHash: users.passwordHash,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      logger.warn("Authentication failure: user not found");
      throw ApiError.unAuthorized("Invalid email or password");
    }

    // Verify password with Argon2id
    const isValid = await verifyPassword(user.passwordHash, input.password);
    if (!isValid) {
      logger.warn("Authentication failure: invalid password hash verification");
      throw ApiError.unAuthorized("Invalid email or password");
    }

    // Generate JWT access token
    const accessToken = await generateToken({
      userId: user.id,
      email: user.email,
    });

    logger.info("User logged in successfully", { userId: user.id });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      accessToken,
    };
  }

  async getCurrentUser(userId: string): Promise<SafeUser> {
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      logger.warn("Authentication failure: user not found for token subject");
      throw ApiError.unAuthorized("User not found");
    }

    return user;
  }
}

export const authService = new AuthService();
