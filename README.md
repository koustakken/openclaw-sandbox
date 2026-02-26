# openclaw-sandbox

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

### Temporary local backend via json-server

If you don't run the real API yet, use mock backend:

```bash
pnpm dev:web-mock
```

This starts:

- `apps/mock-api` on `http://localhost:3001`
- `apps/web` on `http://localhost:5173`

## Environment

- Root: copy `.env.example` to `.env`
- API: copy `apps/api/.env.example` to `apps/api/.env`
- Web: copy `apps/web/.env.example` to `apps/web/.env`

API uses SQLite for auth persistence (`DATABASE_PATH`, default `./data/auth.db`).

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
  mock-api/
packages/
  shared/
  tsconfig/
infra/
  docker/   # commented draft for future dockerization
```
