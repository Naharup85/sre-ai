import { z } from "zod";

export const callbackQuerySchema = z.object({
  installation_id: z.coerce
    .number({ required_error: "installation_id is required" })
    .positive("installation_id must be a positive number"),
  state: z.string({ required_error: "state is required" }).min(1, "state is required"),
  setup_action: z.string().optional(),
});

export const selectRepoSchema = z.object({
  repoId: z.coerce
    .number({ required_error: "repoId is required" })
    .positive("repoId must be a positive number"),
  name: z.string({ required_error: "name is required" }).min(1),
  fullName: z.string({ required_error: "fullName is required" }).min(1),
  ownerLogin: z.string({ required_error: "ownerLogin is required" }).min(1),
  defaultBranch: z.string().default("main"),
  isPrivate: z.boolean().default(false),
  htmlUrl: z.string({ required_error: "htmlUrl is required" }).url("Invalid URL"),
});

export const searchReposSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().positive().max(100).optional(),
  perPage: z.coerce.number().int().positive().max(100).optional(),
});

export const repoParamSchema = z.object({
  id: z.string().min(1, "Repository ID is required"),
});

export type CallbackQuery = z.infer<typeof callbackQuerySchema>;
export type SelectRepoInput = z.infer<typeof selectRepoSchema>;
export type SearchReposQuery = z.infer<typeof searchReposSchema>;
export type RepoParam = z.infer<typeof repoParamSchema>;
