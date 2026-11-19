import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db";
import { githubInstallations } from "../../db/schema/github-installations";
import { repositories } from "../../db/schema/repositories";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import ApiError from "../../utils/errors";
import {
  generateInstallState,
  verifyInstallState,
  getGitHubApp,
  getInstallationClient,
} from "./github.client";
import type { CallbackQuery, SelectRepoInput } from "./github.validation";

export interface AccessibleRepository {
  id: number;
  name: string;
  fullName: string;
  ownerLogin: string;
  defaultBranch: string;
  isPrivate: boolean;
  htmlUrl: string;
  isSelected: boolean;
}

export class GitHubService {
  async getInstallationUrl(userId: string): Promise<{ url: string; state: string }> {
    const state = await generateInstallState(userId);
    const installUrl = `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new?state=${encodeURIComponent(state)}`;
    return { url: installUrl, state };
  }

  async handleCallback(query: CallbackQuery): Promise<{
    installation: typeof githubInstallations.$inferSelect;
    userId: string;
  }> {
    const { userId } = await verifyInstallState(query.state);

    let accountLogin = "github-account";
    let accountType = "User";

    const app = getGitHubApp();
    if (app) {
      try {
        const { data: inst } = await app.octokit.rest.apps.getInstallation({
          installation_id: query.installation_id,
        });
        const account = inst.account as any;
        accountLogin =
          account?.login || account?.name || account?.slug || "github-account";
        accountType = account?.type || inst.target_type || "User";
      } catch (err: any) {
        logger.error("GitHub App installation validation failed", {
          installationId: query.installation_id,
          error: err.message,
        });
        throw ApiError.badRequest("Failed to verify GitHub App installation");
      }
    }

    const installationIdStr = String(query.installation_id);

    // Check if user already has an installation
    const [existing] = await db
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.userId, userId))
      .limit(1);

    let savedInstallation: typeof githubInstallations.$inferSelect;

    if (existing) {
      const [updated] = await db
        .update(githubInstallations)
        .set({
          installationId: installationIdStr,
          accountLogin,
          accountType,
          updatedAt: new Date(),
        })
        .where(eq(githubInstallations.id, existing.id))
        .returning();
      savedInstallation = updated;
    } else {
      const [created] = await db
        .insert(githubInstallations)
        .values({
          userId,
          installationId: installationIdStr,
          accountLogin,
          accountType,
        })
        .returning();
      savedInstallation = created;
    }

    logger.info("GitHub App installation connected successfully", {
      userId,
      accountLogin,
      installationId: installationIdStr,
    });

    return { installation: savedInstallation, userId };
  }

  async getUserInstallation(userId: string) {
    const [installation] = await db
      .select({
        id: githubInstallations.id,
        installationId: githubInstallations.installationId,
        accountLogin: githubInstallations.accountLogin,
        accountType: githubInstallations.accountType,
        createdAt: githubInstallations.createdAt,
      })
      .from(githubInstallations)
      .where(eq(githubInstallations.userId, userId))
      .limit(1);

    if (!installation) {
      return { connected: false, installation: null };
    }

    return { connected: true, installation };
  }

  async disconnectInstallation(userId: string): Promise<void> {
    const [installation] = await db
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.userId, userId))
      .limit(1);

    if (!installation) {
      throw ApiError.notFound("No GitHub installation found to disconnect");
    }

    // Delete installation record (cascades to repositories)
    await db
      .delete(githubInstallations)
      .where(eq(githubInstallations.id, installation.id));

    // Best-effort remote deletion on GitHub if configured
    try {
      const app = getGitHubApp();
      if (app) {
        await app.octokit.rest.apps.deleteInstallation({
          installation_id: Number(installation.installationId),
        });
      }
    } catch {
      // Ignore errors when remote installation is already removed
    }

    logger.info("GitHub App installation disconnected", {
      userId,
      installationId: installation.installationId,
    });
  }

  async listAccessibleRepositories(
    userId: string,
    options?: {
      search?: string;
      page?: number;
      perPage?: number;
    },
  ): Promise<{
    repositories: AccessibleRepository[];
    pagination: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  }> {
    const [inst] = await db
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.userId, userId))
      .limit(1);

    if (!inst) {
      throw ApiError.badRequest(
        "GitHub App is not connected. Please connect GitHub first.",
      );
    }

    const octokit = await getInstallationClient(Number(inst.installationId));

    let repoList: any[] = [];
    try {
      const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({
        per_page: 100,
      });
      repoList = data.repositories;
    } catch (err: any) {
      logger.error("GitHub API error fetching repositories", {
        userId,
        error: err.message,
      });
      if (err.status === 403 || err.status === 429) {
        throw ApiError.forbidden("GitHub API rate limit exceeded or access forbidden");
      }
      throw ApiError.internalServerError(
        `Failed to fetch repositories from GitHub: ${err.message}`,
      );
    }

    // Get all already selected repos for this user to annotate isSelected
    const userRepos = await db
      .select({ githubRepoId: repositories.githubRepoId })
      .from(repositories)
      .where(eq(repositories.userId, userId));

    const selectedSet = new Set(userRepos.map((r) => r.githubRepoId));

    let accessible = repoList.map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      ownerLogin: r.owner?.login || inst.accountLogin,
      defaultBranch: r.default_branch || "main",
      isPrivate: Boolean(r.private),
      htmlUrl: r.html_url,
      isSelected: selectedSet.has(r.id),
    }));

    if (options?.search && options.search.trim().length > 0) {
      const query = options.search.trim().toLowerCase();
      accessible = accessible.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.fullName.toLowerCase().includes(query),
      );
    }

    const total = accessible.length;
    const page = options?.page && options.page > 0 ? options.page : 1;
    const perPage = options?.perPage && options.perPage > 0 ? options.perPage : 100;
    const totalPages = Math.ceil(total / perPage) || 1;
    const startIndex = (page - 1) * perPage;
    const paginatedRepos = accessible.slice(startIndex, startIndex + perPage);

    return {
      repositories: paginatedRepos,
      pagination: {
        page,
        perPage,
        total,
        totalPages,
      },
    };
  }

  async selectRepository(userId: string, input: SelectRepoInput) {
    const [inst] = await db
      .select()
      .from(githubInstallations)
      .where(eq(githubInstallations.userId, userId))
      .limit(1);

    if (!inst) {
      throw ApiError.badRequest(
        "GitHub App is not connected. Please connect GitHub first.",
      );
    }

    // Verify repository is accessible through user's installation
    const octokit = await getInstallationClient(Number(inst.installationId));
    try {
      const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({
        per_page: 100,
      });
      const isAccessible = data.repositories.some((r) => r.id === input.repoId);
      if (!isAccessible) {
        throw ApiError.forbidden(
          "Repository is not accessible to your GitHub App installation",
        );
      }
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      logger.error("GitHub API error verifying repository access", {
        userId,
        error: err.message,
      });
      if (err.status === 403 || err.status === 429) {
        throw ApiError.forbidden("GitHub API rate limit exceeded or access forbidden");
      }
      throw ApiError.internalServerError(
        `Failed to verify repository with GitHub: ${err.message}`,
      );
    }

    // Verify repository is not already selected by this user
    const [existing] = await db
      .select()
      .from(repositories)
      .where(
        and(
          eq(repositories.userId, userId),
          eq(repositories.githubRepoId, input.repoId),
        ),
      )
      .limit(1);

    if (existing) {
      throw ApiError.conflict("Repository has already been selected");
    }

    // Insert into database
    const [saved] = await db
      .insert(repositories)
      .values({
        userId,
        installationId: inst.id,
        githubRepoId: input.repoId,
        name: input.name,
        fullName: input.fullName,
        ownerLogin: input.ownerLogin,
        defaultBranch: input.defaultBranch,
        isPrivate: input.isPrivate,
        htmlUrl: input.htmlUrl,
      })
      .returning();

    logger.info("Repository selected and saved", {
      userId,
      repoId: input.repoId,
      fullName: input.fullName,
    });

    return saved;
  }

  async removeSelectedRepository(userId: string, repositoryId: string) {
    const [existing] = await db
      .select()
      .from(repositories)
      .where(
        and(
          eq(repositories.id, repositoryId),
          eq(repositories.userId, userId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw ApiError.notFound("Repository not found or does not belong to user");
    }

    await db
      .delete(repositories)
      .where(
        and(
          eq(repositories.id, repositoryId),
          eq(repositories.userId, userId),
        ),
      );

    logger.info("Selected repository removed", {
      userId,
      repositoryId,
      repoName: existing.name,
    });

    return existing;
  }

  async getSelectedRepositories(userId: string) {
    return db
      .select({
        id: repositories.id,
        githubRepoId: repositories.githubRepoId,
        name: repositories.name,
        fullName: repositories.fullName,
        ownerLogin: repositories.ownerLogin,
        defaultBranch: repositories.defaultBranch,
        isPrivate: repositories.isPrivate,
        htmlUrl: repositories.htmlUrl,
        createdAt: repositories.createdAt,
      })
      .from(repositories)
      .where(eq(repositories.userId, userId))
      .orderBy(desc(repositories.createdAt));
  }
}

export const gitHubService = new GitHubService();
