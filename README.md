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

## Environment

Copy `.env.example` to `.env` and adjust if needed.

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
