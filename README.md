# openclaw-sandbox

> Autodeploy smoke-test: README updated to verify Vercel automatic redeploy.

TypeScript monorepo:

- `apps/web` — Vite + React
- `apps/api` — Express
- `packages/shared` — shared types/utilities

## Quick start

```bash
pnpm install
pnpm dev
```

By default:

- web: http://localhost:5173
- api: http://localhost:3001

## Environment

- Root: copy `.env.example` to `.env`
- API: copy `apps/api/.env.example` to `apps/api/.env`
- Web: copy `apps/web/.env.example` to `apps/web/.env`

API uses persistent database for auth:

- production: `DATABASE_URL` (Postgres)
- local fallback: `DATABASE_PATH` (SQLite, default `./data/auth.db`)
  For web, set `VITE_API_BASE_URL` (`/api` in local dev, full backend URL in production).

## Scripts

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm format
```

## Project structure

```text
apps/
  web/
  api/
packages/
  shared/
  tsconfig/
infra/
  docker/   # commented draft for future dockerization
```
