# SRE AI

A simple deployment and hosting platform similar to Vercel.

- **Phase 1**: Project Foundation (Monorepo, Express API, Vite React frontend, PostgreSQL + Drizzle ORM).
- **Phase 2**: Authentication (Email/Password with Argon2id & JWT) + Structured Winston Logging.

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

# 2. Start PostgreSQL
docker compose up -d

# 3. Create .env file for the API
cp .env.example apps/api/.env
# Ensure JWT_SECRET is set (at least 32 characters long)

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

## Authentication Architecture

Phase 2 implements email/password authentication using Argon2id and JWT:

- **Password Security**: Passwords are hashed using **Argon2id** (OWASP recommended parameters: 19 MiB memory, 2 iterations, 1 parallelism). Passwords and password hashes are never logged, never returned in API responses, and never stored in plaintext.
- **JWT Access Tokens**: Signed using HMAC SHA-256 (`HS256`) via the `jose` library. Tokens are short-lived (~15 minutes) and include `sub` (user ID), `iat`, and `exp` claims.
- **In-Memory Token Storage**: On the frontend, JWT access tokens are held exclusively in memory (React application state). Tokens are **never** stored in `localStorage`, `sessionStorage`, or URL parameters.
- **Session Refresh Behavior**: In this initial implementation without refresh tokens or persistent storage, refreshing the browser clears in-memory auth state and redirects the user to the login screen.
- **Stateless Logout Limitation**:
  > **Note on Logout**: Because authentication is completely stateless using self-contained short-lived JWT access tokens without database-backed sessions or a centralized token revocation blocklist, `/api/v1/auth/logout` confirms logout on the server while client-side authentication state and tokens are purged from memory. The JWT is not invalidated server-side prior to its natural 15-minute expiration time.

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/health` | None | API health status check |
| `POST` | `/api/v1/auth/register` | Rate limited | Register new user (`name`, `email`, `password`) |
| `POST` | `/api/v1/auth/login` | Rate limited | Log in with credentials (`email`, `password`) |
| `GET` | `/api/v1/auth/me` | Bearer Token | Retrieve authenticated user profile |
| `POST` | `/api/v1/auth/logout` | None | Client-side logout acknowledgment |

---

## Logging Architecture (Winston)

Centralized structured backend logging is powered by **Winston**:

- **Environments**:
  - **Development**: Colorized, human-readable console logging.
  - **Production**: Structured JSON logging including `timestamp`, `level`, `service`, `message`, and `requestId`.
- **Log Levels**: `error`, `warn`, `info`, `http`, `debug`.
- **Request ID Tracking**: Every incoming request receives an `X-Request-Id` (propagating client header or generating a UUID), tracked throughout asynchronous operations via Node.js `AsyncLocalStorage`.
- **Security Redaction**: Sensitive attributes (`password`, `password_hash`, `token`, `jwt`, `authorization`, `cookie`, `secret`) are automatically redacted with `[REDACTED]` before being written to logs.

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
