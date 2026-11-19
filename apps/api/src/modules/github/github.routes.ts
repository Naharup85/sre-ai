import { Router } from "express";
import { gitHubController } from "./github.controller";
import { requireAuth } from "../../middleware/auth.middleware";
import {
  validate,
  validateQuery,
  validateParams,
} from "../../middleware/validate.middleware";
import {
  callbackQuerySchema,
  searchReposSchema,
  selectRepoSchema,
  repoParamSchema,
} from "./github.validation";

const router = Router();

// 1. Generate GitHub App installation URL
router.get("/install", requireAuth, gitHubController.install);

// 2. Handle GitHub App installation callback
router.get(
  "/callback",
  validateQuery(callbackQuerySchema),
  gitHubController.callback,
);

// 3. Get connected installation for authenticated user
router.get("/installation", requireAuth, gitHubController.getInstallation);

// 4. Disconnect GitHub installation
router.delete("/installation", requireAuth, gitHubController.disconnect);

// 5. List accessible repositories for authenticated user's installation
router.get(
  "/repositories",
  requireAuth,
  validateQuery(searchReposSchema),
  (req, res, next) => gitHubController.listRepositories(req, res, next),
);

// 6. Select and save a repository
router.post(
  "/repositories/select",
  requireAuth,
  validate(selectRepoSchema),
  (req, res, next) => gitHubController.selectRepository(req, res, next),
);

// 7. Get user's selected repositories from database
router.get("/repositories/selected", requireAuth, (req, res, next) =>
  gitHubController.getSelectedRepositories(req, res, next),
);

// 8. Remove a selected repository
router.delete(
  "/repositories/:id",
  requireAuth,
  validateParams(repoParamSchema),
  (req, res, next) => gitHubController.removeRepository(req, res, next),
);

export default router;
