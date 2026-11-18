import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  bigint,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { githubInstallations } from "./github-installations";

export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    installationId: uuid("installation_id")
      .notNull()
      .references(() => githubInstallations.id, { onDelete: "cascade" }),
    githubRepoId: bigint("github_repo_id", { mode: "number" }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    ownerLogin: varchar("owner_login", { length: 255 }).notNull(),
    defaultBranch: varchar("default_branch", { length: 100 })
      .notNull()
      .default("main"),
    isPrivate: boolean("is_private").notNull().default(false),
    htmlUrl: text("html_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userRepoUnique: unique("user_github_repo_unique").on(
      table.userId,
      table.githubRepoId,
    ),
  }),
);
