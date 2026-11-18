import { App, Octokit } from "octokit";
import * as jose from "jose";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import ApiError from "../../utils/errors";

let gitHubAppInstance: App | null = null;

// Allow injecting mock Octokit for testing
type OctokitProvider = (installationId: number) => Promise<Octokit>;
let mockOctokitProvider: OctokitProvider | null = null;
let mockGitHubApp: any = null;

export function setMockOctokitProvider(provider: OctokitProvider | null) {
  mockOctokitProvider = provider;
}

export function setMockGitHubApp(app: any) {
  mockGitHubApp = app;
}

function formatPrivateKey(rawKey: string): string {
  if (!rawKey) return "";
  // Check if base64 encoded
  if (!rawKey.includes("-----BEGIN") && !rawKey.includes("\n")) {
    try {
      const decoded = Buffer.from(rawKey, "base64").toString("utf8");
      if (decoded.includes("-----BEGIN")) {
        return decoded;
      }
    } catch {
      // not base64, proceed
    }
  }
  // Replace literal '\n' sequences with real newlines
  return rawKey.replace(/\\n/g, "\n");
}

export function getGitHubApp(): App | null {
  if (mockGitHubApp) {
    return mockGitHubApp;
  }

  if (gitHubAppInstance) {
    return gitHubAppInstance;
  }

  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    return null;
  }

  try {
    const privateKey = formatPrivateKey(env.GITHUB_APP_PRIVATE_KEY);
    gitHubAppInstance = new App({
      appId: env.GITHUB_APP_ID,
      privateKey,
    });
    return gitHubAppInstance;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Failed to initialize GitHub App instance", { error: message });
    return null;
  }
}

export async function getInstallationClient(
  installationId: number,
): Promise<Octokit> {
  if (mockOctokitProvider) {
    return mockOctokitProvider(installationId);
  }

  const app = getGitHubApp();
  if (!app) {
    throw ApiError.internalServerError(
      "GitHub App is not configured. Please set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY in .env",
    );
  }

  try {
    return await app.getInstallationOctokit(installationId);
  } catch (error: any) {
    logger.error("Failed to get installation Octokit client", {
      installationId,
      error: error.message,
    });
    if (error.status === 404) {
      throw ApiError.notFound("GitHub installation not found or deleted on GitHub");
    }
    if (error.status === 403 || error.status === 401) {
      throw ApiError.forbidden("Access denied to GitHub installation");
    }
    throw ApiError.internalServerError(
      `GitHub API error: ${error.message || "Failed to authenticate installation"}`,
    );
  }
}

// Generate a cryptographically secure CSRF state token bound to userId
export async function generateInstallState(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  return new jose.SignJWT({
    userId,
    purpose: "github_app_install",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret);
}

// Validate the CSRF state token
export async function verifyInstallState(
  state: string,
): Promise<{ userId: string }> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jose.jwtVerify(state, secret, {
      algorithms: ["HS256"],
    });

    if (payload.purpose !== "github_app_install" || !payload.userId) {
      throw new Error("Invalid state payload");
    }

    return { userId: payload.userId as string };
  } catch {
    throw ApiError.badRequest("Invalid or expired state parameter");
  }
}
