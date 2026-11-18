import { describe, it, expect, beforeEach, vi } from "vitest";
import * as jose from "jose";
import { request } from "./test-client";
import { mockDb, resetMockUsers } from "./mock-db";

vi.mock("../src/db", () => ({
  db: mockDb,
}));

import app from "../src/app";
import {
  setMockOctokitProvider,
  setMockGitHubApp,
} from "../src/modules/github/github.client";
import { env } from "../src/config/env";

describe("GitHub App Integration & Repository Selection", () => {
  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;

  const mockRepos = [
    {
      id: 101,
      name: "next-saas-starter",
      full_name: "sachin/next-saas-starter",
      owner: { login: "sachin" },
      private: false,
      default_branch: "main",
      html_url: "https://github.com/sachin/next-saas-starter",
    },
    {
      id: 102,
      name: "api-backend",
      full_name: "sachin/api-backend",
      owner: { login: "sachin" },
      private: true,
      default_branch: "develop",
      html_url: "https://github.com/sachin/api-backend",
    },
    {
      id: 103,
      name: "docs-site",
      full_name: "sachin/docs-site",
      owner: { login: "sachin" },
      private: false,
      default_branch: "master",
      html_url: "https://github.com/sachin/docs-site",
    },
  ];

  beforeEach(async () => {
    resetMockUsers();

    // Register User A
    const regA = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "User A",
        email: "user.a@example.com",
        password: "password-1234",
      });
    userAToken = regA.body.data.accessToken;
    userAId = regA.body.data.user.id;

    // Register User B
    const regB = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "User B",
        email: "user.b@example.com",
        password: "password-5678",
      });
    userBToken = regB.body.data.accessToken;
    userBId = regB.body.data.user.id;

    // Set default mock Octokit client
    setMockGitHubApp({
      octokit: {
        rest: {
          apps: {
            getInstallation: async (params: { installation_id: number }) => ({
              data: {
                id: params.installation_id,
                account: {
                  login: "sachin",
                  type: "User",
                },
              },
            }),
          },
        },
      },
    });

    setMockOctokitProvider(async () => {
      return {
        rest: {
          apps: {
            listReposAccessibleToInstallation: async () => ({
              data: {
                total_count: mockRepos.length,
                repositories: mockRepos,
              },
            }),
          },
        },
      } as any;
    });
  });

  describe("1. Starting Installation Flow (GET /api/v1/github/install)", () => {
    it("should return installation URL with secure CSRF state token bound to authenticated user", async () => {
      const response = await request(app)
        .get("/api/v1/github/install")
        .set("Authorization", `Bearer ${userAToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.url).toBeDefined();
      expect(response.body.data.url).toContain("https://github.com/apps/");
      expect(response.body.data.url).toContain("state=");
      expect(response.body.data.state).toBeDefined();

      // Verify the state token payload
      const secret = new TextEncoder().encode(env.JWT_SECRET);
      const { payload } = await jose.jwtVerify(response.body.data.state, secret);
      expect(payload.userId).toBe(userAId);
      expect(payload.purpose).toBe("github_app_install");
    });

    it("should require authentication to start installation flow", async () => {
      const response = await request(app).get("/api/v1/github/install");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe("2. Callback Handling & State Validation (GET /api/v1/github/callback)", () => {
    it("should successfully process a valid installation callback and store installation", async () => {
      const installRes = await request(app)
        .get("/api/v1/github/install")
        .set("Authorization", `Bearer ${userAToken}`);
      const validState = installRes.body.data.state;

      const callbackRes = await request(app)
        .get(`/api/v1/github/callback?installation_id=98765432&state=${validState}`)
        .set("Accept", "application/json");

      expect(callbackRes.status).toBe(200);
      expect(callbackRes.body.success).toBe(true);
      expect(callbackRes.body.data.installation).toBeDefined();
      expect(callbackRes.body.data.installation.installationId).toBe("98765432");
      expect(callbackRes.body.data.installation.userId).toBe(userAId);
    });

    it("should reject an invalid or tampered state parameter", async () => {
      const callbackRes = await request(app)
        .get("/api/v1/github/callback?installation_id=98765432&state=invalid-state-token")
        .set("Accept", "application/json");

      expect(callbackRes.status).toBe(400);
      expect(callbackRes.body.success).toBe(false);
      expect(callbackRes.body.message).toContain("Invalid or expired state");
    });

    it("should reject an expired state parameter", async () => {
      const secret = new TextEncoder().encode(env.JWT_SECRET);
      const expiredState = await new jose.SignJWT({
        userId: userAId,
        purpose: "github_app_install",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
        .sign(secret);

      const callbackRes = await request(app)
        .get(`/api/v1/github/callback?installation_id=98765432&state=${expiredState}`)
        .set("Accept", "application/json");

      expect(callbackRes.status).toBe(400);
      expect(callbackRes.body.success).toBe(false);
    });

    it("should reject missing required callback query parameters", async () => {
      const callbackRes = await request(app)
        .get("/api/v1/github/callback")
        .set("Accept", "application/json");

      expect(callbackRes.status).toBe(400);
      expect(callbackRes.body.success).toBe(false);
    });
  });

  describe("3. Retrieving User's Installation (GET /api/v1/github/installation)", () => {
    it("should return connected: false when user has no connected installation", async () => {
      const response = await request(app)
        .get("/api/v1/github/installation")
        .set("Authorization", `Bearer ${userAToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.connected).toBe(false);
      expect(response.body.data.installation).toBeNull();
    });

    it("should return connected: true and installation details when connected", async () => {
      // Connect User A
      const installRes = await request(app)
        .get("/api/v1/github/install")
        .set("Authorization", `Bearer ${userAToken}`);
      await request(app)
        .get(`/api/v1/github/callback?installation_id=11223344&state=${installRes.body.data.state}`)
        .set("Accept", "application/json");

      const response = await request(app)
        .get("/api/v1/github/installation")
        .set("Authorization", `Bearer ${userAToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.connected).toBe(true);
      expect(response.body.data.installation.installationId).toBe("11223344");
    });
  });

  describe("4. Listing and Searching Repositories (GET /api/v1/github/repositories)", () => {
    beforeEach(async () => {
      // Connect User A
      const installRes = await request(app)
        .get("/api/v1/github/install")
        .set("Authorization", `Bearer ${userAToken}`);
      await request(app)
        .get(`/api/v1/github/callback?installation_id=55667788&state=${installRes.body.data.state}`)
        .set("Accept", "application/json");
    });

    it("should list accessible repositories with isSelected: false initially", async () => {
      const response = await request(app)
        .get("/api/v1/github/repositories")
        .set("Authorization", `Bearer ${userAToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.repositories).toHaveLength(3);
      expect(response.body.data.repositories[0].name).toBe("next-saas-starter");
      expect(response.body.data.repositories[0].isSelected).toBe(false);
      // Ensure private keys or tokens are never returned
      expect(JSON.stringify(response.body)).not.toContain("privateKey");
      expect(JSON.stringify(response.body)).not.toContain("token");
    });

    it("should search repositories by name query", async () => {
      const response = await request(app)
        .get("/api/v1/github/repositories?search=backend")
        .set("Authorization", `Bearer ${userAToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.repositories).toHaveLength(1);
      expect(response.body.data.repositories[0].name).toBe("api-backend");
      expect(response.body.data.repositories[0].isPrivate).toBe(true);
    });

    it("should return empty list when search term matches no repositories", async () => {
      const response = await request(app)
        .get("/api/v1/github/repositories?search=nonexistent-repo-xyz")
        .set("Authorization", `Bearer ${userAToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.repositories).toHaveLength(0);
    });

    it("should reject listing repositories if GitHub App is not connected", async () => {
      // User B has not connected GitHub
      const response = await request(app)
        .get("/api/v1/github/repositories")
        .set("Authorization", `Bearer ${userBToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("GitHub App is not connected");
    });
  });

  describe("5. Selecting and Saving Repositories", () => {
    beforeEach(async () => {
      // Connect User A
      const installRes = await request(app)
        .get("/api/v1/github/install")
        .set("Authorization", `Bearer ${userAToken}`);
      await request(app)
        .get(`/api/v1/github/callback?installation_id=55667788&state=${installRes.body.data.state}`)
        .set("Accept", "application/json");
    });

    it("should successfully select and save a repository", async () => {
      const response = await request(app)
        .post("/api/v1/github/repositories/select")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          repoId: 101,
          name: "next-saas-starter",
          fullName: "sachin/next-saas-starter",
          ownerLogin: "sachin",
          defaultBranch: "main",
          isPrivate: false,
          htmlUrl: "https://github.com/sachin/next-saas-starter",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.repository.githubRepoId).toBe(101);
      expect(response.body.data.repository.name).toBe("next-saas-starter");
      expect(response.body.data.repository.userId).toBe(userAId);

      // Verify it is now marked as isSelected in the repository list
      const listRes = await request(app)
        .get("/api/v1/github/repositories")
        .set("Authorization", `Bearer ${userAToken}`);

      const selectedRepo = listRes.body.data.repositories.find(
        (r: any) => r.id === 101,
      );
      expect(selectedRepo.isSelected).toBe(true);

      // Verify it shows in selected repositories endpoint
      const selectedRes = await request(app)
        .get("/api/v1/github/repositories/selected")
        .set("Authorization", `Bearer ${userAToken}`);

      expect(selectedRes.status).toBe(200);
      expect(selectedRes.body.data.repositories).toHaveLength(1);
      expect(selectedRes.body.data.repositories[0].name).toBe("next-saas-starter");
    });

    it("should prevent duplicate selection of the same repository for the user", async () => {
      // First selection
      await request(app)
        .post("/api/v1/github/repositories/select")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          repoId: 101,
          name: "next-saas-starter",
          fullName: "sachin/next-saas-starter",
          ownerLogin: "sachin",
          defaultBranch: "main",
          isPrivate: false,
          htmlUrl: "https://github.com/sachin/next-saas-starter",
        });

      // Duplicate selection attempt
      const duplicateRes = await request(app)
        .post("/api/v1/github/repositories/select")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          repoId: 101,
          name: "next-saas-starter",
          fullName: "sachin/next-saas-starter",
          ownerLogin: "sachin",
          defaultBranch: "main",
          isPrivate: false,
          htmlUrl: "https://github.com/sachin/next-saas-starter",
        });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.success).toBe(false);
      expect(duplicateRes.body.message).toContain("already");
    });
  });

  describe("6. Cross-User Access Isolation", () => {
    it("should not allow User B to view or manipulate User A's repositories or installation", async () => {
      // Connect User A and select a repo
      const installRes = await request(app)
        .get("/api/v1/github/install")
        .set("Authorization", `Bearer ${userAToken}`);
      await request(app)
        .get(`/api/v1/github/callback?installation_id=55667788&state=${installRes.body.data.state}`)
        .set("Accept", "application/json");

      await request(app)
        .post("/api/v1/github/repositories/select")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          repoId: 101,
          name: "next-saas-starter",
          fullName: "sachin/next-saas-starter",
          ownerLogin: "sachin",
          defaultBranch: "main",
          isPrivate: false,
          htmlUrl: "https://github.com/sachin/next-saas-starter",
        });

      // User B checks installation status: must be disconnected
      const userBInst = await request(app)
        .get("/api/v1/github/installation")
        .set("Authorization", `Bearer ${userBToken}`);
      expect(userBInst.body.data.connected).toBe(false);

      // User B checks selected repositories: must be empty
      const userBRepos = await request(app)
        .get("/api/v1/github/repositories/selected")
        .set("Authorization", `Bearer ${userBToken}`);
      expect(userBRepos.body.data.repositories).toHaveLength(0);
    });
  });

  describe("7. Disconnecting Installation (DELETE /api/v1/github/installation)", () => {
    it("should disconnect installation and remove all user repositories", async () => {
      // Connect User A and select a repo
      const installRes = await request(app)
        .get("/api/v1/github/install")
        .set("Authorization", `Bearer ${userAToken}`);
      await request(app)
        .get(`/api/v1/github/callback?installation_id=55667788&state=${installRes.body.data.state}`)
        .set("Accept", "application/json");

      await request(app)
        .post("/api/v1/github/repositories/select")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          repoId: 101,
          name: "next-saas-starter",
          fullName: "sachin/next-saas-starter",
          ownerLogin: "sachin",
          defaultBranch: "main",
          isPrivate: false,
          htmlUrl: "https://github.com/sachin/next-saas-starter",
        });

      // Disconnect
      const disconnectRes = await request(app)
        .delete("/api/v1/github/installation")
        .set("Authorization", `Bearer ${userAToken}`);

      expect(disconnectRes.status).toBe(200);
      expect(disconnectRes.body.success).toBe(true);

      // Verify installation is now disconnected
      const instRes = await request(app)
        .get("/api/v1/github/installation")
        .set("Authorization", `Bearer ${userAToken}`);
      expect(instRes.body.data.connected).toBe(false);

      // Verify selected repositories are removed
      const reposRes = await request(app)
        .get("/api/v1/github/repositories/selected")
        .set("Authorization", `Bearer ${userAToken}`);
      expect(reposRes.body.data.repositories).toHaveLength(0);
    });

    it("should return 404 when attempting to disconnect if not connected", async () => {
      const disconnectRes = await request(app)
        .delete("/api/v1/github/installation")
        .set("Authorization", `Bearer ${userBToken}`);

      expect(disconnectRes.status).toBe(404);
      expect(disconnectRes.body.success).toBe(false);
    });
  });

  describe("8. Handling GitHub API Errors and Rate Limits", () => {
    it("should handle GitHub API 403 / 429 rate limit errors gracefully", async () => {
      // Connect User A
      const installRes = await request(app)
        .get("/api/v1/github/install")
        .set("Authorization", `Bearer ${userAToken}`);
      await request(app)
        .get(`/api/v1/github/callback?installation_id=55667788&state=${installRes.body.data.state}`)
        .set("Accept", "application/json");

      // Inject rate limit error from GitHub
      setMockOctokitProvider(async () => {
        return {
          rest: {
            apps: {
              listReposAccessibleToInstallation: async () => {
                const error: any = new Error("API rate limit exceeded");
                error.status = 403;
                throw error;
              },
            },
          },
        } as any;
      });

      const response = await request(app)
        .get("/api/v1/github/repositories")
        .set("Authorization", `Bearer ${userAToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("rate limit");
    });
  });
});
