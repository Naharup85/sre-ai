# SRE AI

A deployment and hosting platform. Phase 1: Project Foundation.

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker & Docker Compose

## Getting Started

```bash
# Install dependencies
pnpm install

# Start PostgreSQL
docker compose up -d

# Create .env file for the API
cp .env.example apps/api/.env
# Edit apps/api/.env and set DATABASE_URL=postgresql://sre_ai:sre_ai_password@localhost:5432/sre_ai_db

# Run database migrations
pnpm db:generate
pnpm db:migrate

# Start development servers
pnpm dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3000
- Health check: http://localhost:3000/api/v1/health

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all dev servers |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm lint` | Lint all packages |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Run Drizzle migrations |
