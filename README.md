# SRE AI

A simple deployment and hosting platform similar to Vercel.

- **Phase 1**: Project Foundation (Monorepo, Express API, Vite React frontend, PostgreSQL + Drizzle ORM).
- **Phase 2**: Authentication (Email/Password with Argon2id & JWT) + Structured Winston Logging.
- **Phase 3**: GitHub App Integration & Repository Selection (Official GitHub App flow, Octokit, Repository Management).

---

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker & Docker Compose

---

## Getting Started

```bash
# 1. Install dependencies
pnpm install

# 2. Start PostgreSQL container
docker compose up -d

# 3. Create .env file for the API
cp .env.example apps/api/.env
# Configure JWT_SECRET (at least 32 characters)
# Configure GitHub App variables (see GitHub App Configuration section below)

# 4. Run database migrations
pnpm db:generate
pnpm db:migrate

# 5. Start development servers
pnpm dev
```

- **Frontend**: http://localhost:5173
- **API**: http://localhost:3000
- **API Health check**: http://localhost:3000/api/v1/health

---

## GitHub App Configuration Guide

To enable real GitHub integration in development or production:

1. Go to your GitHub account settings:
   - Personal account: **Settings** &rarr; **Developer settings** &rarr; **GitHub Apps** &rarr; **New GitHub App**.
   - Organization: **Organization Settings** &rarr; **Developer settings** &rarr; **GitHub Apps** &rarr; **New GitHub App**.
2. Fill in the general settings:
   - **GitHub App name**: `sre-ai-app` (must be globally unique on GitHub, or choose your own).
   - **Homepage URL**: `http://localhost:5173`
   - **Callback URL**: `http://localhost:3000/api/v1/github/callback`
   - **Webhook**: Uncheck "Active" (webhooks are not needed for Phase 3).
3. Set **Permissions** (Least Privilege):
   - **Repository permissions**:
     - `Metadata`: **Read-only** (automatically selected).
     - `Contents`: **Read-only** (to list repositories and branches).
   - No write permissions are requested or required.
4. Set **Where can this GitHub App be installed?**:
   - Select **Any account** (to allow both personal and organization installations).
5. Create the GitHub App.
6. Once created:
   - Note the **App ID** &rarr; set as `GITHUB_APP_ID`.
   - Note the **App Slug** (the last segment of your App URL) &rarr; set as `GITHUB_APP_SLUG`.
   - Scroll down to **Private keys** and click **Generate a private key**.
   - A `.pem` file will be downloaded. Copy its entire content into `GITHUB_APP_PRIVATE_KEY` (either with `\n` or as a base64 encoded string).

### Environment Variables

| Variable | Required | Default / Description |
|---|---|---|
| `PORT` | Yes | `3000` |
| `NODE_ENV` | Yes | `development` / `production` / `test` |
| `DATABASE_URL` | Yes | `postgresql://sre_ai:sre_ai_password@localhost:5432/sre_ai_db` |
| `FRONTEND_URL` | Yes | `http://localhost:5173` |
| `JWT_SECRET` | Yes | Minimum 32-character HMAC key |
| `JWT_EXPIRES_IN` | Yes | `15m` |
| `GITHUB_APP_ID` | Optional in dev/test | Numeric GitHub App ID |
| `GITHUB_APP_PRIVATE_KEY` | Optional in dev/test | PEM private key or base64 PEM |
| `GITHUB_APP_NAME` | No | `sre-ai-app` |
| `GITHUB_APP_SLUG` | No | `sre-ai-app` |
| `GITHUB_CALLBACK_URL` | No | `http://localhost:3000/api/v1/github/callback` |

---

## Authentication Architecture

- **Password Security**: Passwords are hashed using **Argon2id** (OWASP recommended parameters: 19 MiB memory, 2 iterations, 1 parallelism). Passwords and password hashes are never logged, never returned in API responses, and never stored in plaintext.
- **JWT Access Tokens**: Signed using HMAC SHA-256 (`HS256`) via `jose`. Tokens are short-lived (~15 minutes) and include `sub` (user ID), `iat`, and `exp` claims.
- **In-Memory Token Storage**: Access tokens are held exclusively in memory (React application state). Tokens are **never** stored in `localStorage`, `sessionStorage`, or URL parameters.
- **Stateless Logout**: Confirms logout on the server while client-side authentication state and tokens are purged from memory.

---

## GitHub Integration & Repository Architecture (Phase 3)

- **Official Installation Flow**:
  1. `GET /api/v1/github/install` generates an installation URL with a signed CSRF state token bound to the authenticated user ID (10-minute expiry).
  2. The user installs the GitHub App on their GitHub account or organization.
  3. GitHub redirects to `GET /api/v1/github/callback?installation_id=...&state=...`.
  4. The server validates the CSRF token signature, verifies installation ownership via Octokit, and upserts the `github_installations` record.
  5. The browser is redirected back to the SRE AI settings/projects page.
- **Repository Access & Tokens**:
  - Short-lived installation access tokens are generated server-side on-demand via Octokit's `app.getInstallationOctokit()`.
  - Installation tokens and private keys are never exposed to the client or returned in API responses.
- **Repository Selection & Deduplication**:
  - Users can list and search accessible repositories (`GET /api/v1/github/repositories`).
  - Selecting a repository (`POST /api/v1/github/repositories/select`) saves the repository in the SRE AI database.
  - A unique constraint `(user_id, github_repo_id)` prevents duplicate imports for the same user.
  - Cross-user data isolation ensures users can only access their own installations and repositories.

---

## API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/health` | None | API health status check |
| `POST` | `/api/v1/auth/register` | Rate limited | Register new user |
| `POST` | `/api/v1/auth/login` | Rate limited | Log in with credentials |
| `GET` | `/api/v1/auth/me` | Bearer Token | Retrieve authenticated user profile |
| `POST` | `/api/v1/auth/logout` | None | Client-side logout acknowledgment |

### GitHub Integration & Repositories (Phase 3)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/github/install` | Bearer Token | Generate GitHub App installation URL with CSRF state |
| `GET` | `/api/v1/github/callback` | State Validation | Handle installation callback from GitHub |
| `GET` | `/api/v1/github/installation` | Bearer Token | Retrieve current user's GitHub installation status |
| `DELETE` | `/api/v1/github/installation` | Bearer Token | Disconnect GitHub installation and remove repositories |
| `GET` | `/api/v1/github/repositories` | Bearer Token | List accessible repositories (supports `?search=...`) |
| `POST` | `/api/v1/github/repositories/select` | Bearer Token | Select and save repository to SRE AI database |
| `GET` | `/api/v1/github/repositories/selected` | Bearer Token | Retrieve all imported repositories for authenticated user |

---

## Database Entities

### `users`
- `id` (UUID, PK)
- `name` (VARCHAR)
- `email` (VARCHAR, Unique)
- `password_hash` (TEXT)
- `created_at` (TIMESTAMP WITH TIME ZONE)
- `updated_at` (TIMESTAMP WITH TIME ZONE)

### `github_installations`
- `id` (UUID, PK)
- `user_id` (UUID, FK &rarr; users.id ON DELETE CASCADE)
- `installation_id` (VARCHAR, Unique)
- `account_login` (VARCHAR)
- `account_type` (VARCHAR)
- `created_at` (TIMESTAMP WITH TIME ZONE)
- `updated_at` (TIMESTAMP WITH TIME ZONE)

### `repositories`
- `id` (UUID, PK)
- `user_id` (UUID, FK &rarr; users.id ON DELETE CASCADE)
- `installation_id` (UUID, FK &rarr; github_installations.id ON DELETE CASCADE)
- `github_repo_id` (BIGINT)
- `name` (VARCHAR)
- `full_name` (VARCHAR)
- `owner_login` (VARCHAR)
- `default_branch` (VARCHAR, default `'main'`)
- `is_private` (BOOLEAN, default `false`)
- `html_url` (TEXT)
- `created_at` (TIMESTAMP WITH TIME ZONE)
- `updated_at` (TIMESTAMP WITH TIME ZONE)
- *Constraint*: `UNIQUE(user_id, github_repo_id)`

---

## Testing & Quality Assurance

Automated tests cover all Phase 1, 2, and 3 capabilities:

```bash
pnpm test
```

- **Unit/Integration Test Suites** (`tests/auth.test.ts`, `tests/logging.test.ts`, `tests/github.test.ts`):
  - Mock external GitHub API calls and token generation using Octokit provider hooks.
  - Test CSRF state validation, installation callbacks, repository listing, searching, deduplication, cross-user isolation, and rate limit errors.
- **Database Integration Tests** (`tests/github-db.integration.test.ts`):
  - Runs directly against the live local PostgreSQL database.
  - Verifies foreign key constraints, cascading deletes, and unique constraint enforcement.

---

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all dev servers concurrently |
| `pnpm build` | Build all packages and applications |
| `pnpm typecheck` | Run TypeScript type checks across the monorepo |
| `pnpm lint` | Lint frontend and backend code |
| `pnpm test` | Run automated test suites |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Run Drizzle migrations against PostgreSQL |
