import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, and } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "../src/config/env";
import { users } from "../src/db/schema/users";
import { githubInstallations } from "../src/db/schema/github-installations";
import { repositories } from "../src/db/schema/repositories";

describe("PostgreSQL Real Database Integration", () => {
  let isDbAvailable = false;
  let testClient: ReturnType<typeof postgres> | null = null;
  let realDb: ReturnType<typeof drizzle> | null = null;
  let createdUserId: string | null = null;

  beforeAll(async () => {
    try {
      testClient = postgres(env.DATABASE_URL, { connect_timeout: 1, max: 1 });
      await testClient`SELECT 1`;
      realDb = drizzle(testClient);
      isDbAvailable = true;
    } catch {
      isDbAvailable = false;
    }
  });

  afterAll(async () => {
    if (isDbAvailable && realDb && createdUserId) {
      await realDb.delete(users).where(eq(users.id, createdUserId));
    }
    if (testClient) {
      await testClient.end({ timeout: 1 });
    }
  });

  it("should enforce foreign keys and unique constraints in real PostgreSQL", async (ctx) => {
    if (!isDbAvailable || !realDb) {
      ctx.skip();
      return;
    }

    // 1. Insert user
    const [user] = await realDb
      .insert(users)
      .values({
        name: "Integration Test User",
        email: `pg.integration.${Date.now()}@example.com`,
        passwordHash: "dummy-hash",
      })
      .returning();
    createdUserId = user.id;

    // 2. Insert GitHub installation
    const testInstId = `inst_${Date.now()}`;
    const [inst] = await realDb
      .insert(githubInstallations)
      .values({
        userId: user.id,
        installationId: testInstId,
        accountLogin: "test-login",
        accountType: "User",
      })
      .returning();

    expect(inst.userId).toBe(user.id);
    expect(inst.installationId).toBe(testInstId);

    // 3. Insert repository
    const [repo] = await realDb
      .insert(repositories)
      .values({
        userId: user.id,
        installationId: inst.id,
        githubRepoId: 888123,
        name: "integration-repo",
        fullName: "test-login/integration-repo",
        ownerLogin: "test-login",
        defaultBranch: "main",
        isPrivate: true,
        htmlUrl: "https://github.com/test-login/integration-repo",
      })
      .returning();

    expect(repo.githubRepoId).toBe(888123);
    expect(repo.installationId).toBe(inst.id);

    // 4. Verify unique constraint user_github_repo_unique prevents duplicates
    await expect(
      realDb.insert(repositories).values({
        userId: user.id,
        installationId: inst.id,
        githubRepoId: 888123,
        name: "integration-repo-duplicate",
        fullName: "test-login/integration-repo-duplicate",
        ownerLogin: "test-login",
        defaultBranch: "main",
        isPrivate: true,
        htmlUrl: "https://github.com/test-login/integration-repo",
      }),
    ).rejects.toThrow();

    // 5. Verify cascading delete: deleting installation removes repositories
    await realDb
      .delete(githubInstallations)
      .where(eq(githubInstallations.id, inst.id));

    const remainingRepos = await realDb
      .select()
      .from(repositories)
      .where(eq(repositories.userId, user.id));

    expect(remainingRepos).toHaveLength(0);
  });
});
