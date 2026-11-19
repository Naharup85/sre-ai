import type { Request, Response, NextFunction } from "express";
import { gitHubService } from "./github.service";
import type { CallbackQuery, SearchReposQuery } from "./github.validation";
import { env } from "../../config/env";
import ApiResponse from "../../utils/response";
import ApiError from "../../utils/errors";

export class GitHubController {
  async install(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) {
        throw ApiError.unAuthorized("Unauthorized");
      }
      const result = await gitHubService.getInstallationUrl(req.user.id);
      return ApiResponse.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async callback(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await gitHubService.handleCallback(
        req.query as unknown as CallbackQuery,
      );
      // If requested by browser redirect from GitHub App install
      if (
        req.accepts("html") &&
        !req.xhr &&
        !req.headers.accept?.includes("application/json")
      ) {
        return res.redirect(
          `${env.FRONTEND_URL}/settings?github=connected&account=${encodeURIComponent(result.installation.accountLogin)}`,
        );
      }

      return ApiResponse.success(
        res,
        { installation: result.installation },
        "GitHub App connected successfully",
      );
    } catch (error) {
      if (
        req.accepts("html") &&
        !req.xhr &&
        !req.headers.accept?.includes("application/json") &&
        error instanceof Error
      ) {
        return res.redirect(
          `${env.FRONTEND_URL}/settings?error=${encodeURIComponent(error.message)}`,
        );
      }
      next(error);
    }
  }

  async getInstallation(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) {
        throw ApiError.unAuthorized("Unauthorized");
      }
      const result = await gitHubService.getUserInstallation(req.user.id);
      return ApiResponse.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async disconnect(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) {
        throw ApiError.unAuthorized("Unauthorized");
      }
      await gitHubService.disconnectInstallation(req.user.id);
      return ApiResponse.success(
        res,
        null,
        "GitHub installation disconnected successfully",
      );
    } catch (error) {
      next(error);
    }
  }

  async listRepositories(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) {
        throw ApiError.unAuthorized("Unauthorized");
      }
      const query = req.query as unknown as SearchReposQuery;
      const perPage = query.perPage || query.per_page;
      const result = await gitHubService.listAccessibleRepositories(
        req.user.id,
        {
          search: query.search,
          page: query.page,
          perPage,
        },
      );
      return ApiResponse.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async selectRepository(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) {
        throw ApiError.unAuthorized("Unauthorized");
      }
      const repository = await gitHubService.selectRepository(
        req.user.id,
        req.body,
      );
      return ApiResponse.create(res, { repository });
    } catch (error) {
      next(error);
    }
  }

  async removeRepository(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) {
        throw ApiError.unAuthorized("Unauthorized");
      }
      const repoId = String(req.params.id);
      const repository = await gitHubService.removeSelectedRepository(
        req.user.id,
        repoId,
      );
      return ApiResponse.success(
        res,
        { repository },
        "Repository removed successfully",
      );
    } catch (error) {
      next(error);
    }
  }

  async getSelectedRepositories(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user?.id) {
        throw ApiError.unAuthorized("Unauthorized");
      }
      const repositories = await gitHubService.getSelectedRepositories(
        req.user.id,
      );
      return ApiResponse.success(res, { repositories });
    } catch (error) {
      next(error);
    }
  }
}

export const gitHubController = new GitHubController();
