import type { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service";
import ApiError from "../../utils/errors";
import ApiResponse from "../../utils/response";

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      return ApiResponse.create(res, result);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      return ApiResponse.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) {
        throw ApiError.unAuthorized("Unauthorized");
      }
      const user = await authService.getCurrentUser(req.user.id);
      return ApiResponse.success(res, { user });
    } catch (error) {
      next(error);
    }
  }

  async logout(_req: Request, res: Response) {
    return ApiResponse.success(res, null, "Logged out successfully");
  }
}

export const authController = new AuthController();
