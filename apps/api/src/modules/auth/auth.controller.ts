import type { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service";
import { env } from "../../config/env";
import ApiError from "../../utils/errors";
import ApiResponse from "../../utils/response";

type CookieOption = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax" | "none";
  maxAge: number;
  path: string;
};

const isProduction = env.NODE_ENV === "production";

const cookieOptions: CookieOption = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "strict" : "lax",
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  path: "/",
};

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      res.cookie("token", result.accessToken, cookieOptions);
      return ApiResponse.create(res, result);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      res.cookie("token", result.accessToken, cookieOptions);
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
    res.clearCookie("token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
      path: "/",
    });
    return ApiResponse.success(res, null, "Logged out successfully");
  }
}

export const authController = new AuthController();
