import { Router } from "express";
import { authController } from "./auth.controller";
import { requireAuth } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { rateLimiter } from "../../middleware/rate-limit.middleware";
import { registerSchema, loginSchema } from "./auth.validation";

const router = Router();
const windowMs = 15 * 60 * 1000;
const max = 30;

router.post("/register",rateLimiter(windowMs, max),validate(registerSchema),authController.register);

router.post("/login",rateLimiter(windowMs, max),validate(loginSchema), authController.login);

router.get("/me", requireAuth, authController.me);

router.post("/logout",authController.logout);

export default router;
