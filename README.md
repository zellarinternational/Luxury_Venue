# Event Venue Studio

A ground-up rewrite of the venue-browsing + 3D hall-layout-planning app. See
[`docs/ARCHITECTURE_PLAN.md`](./docs/ARCHITECTURE_PLAN.md) for the full
rationale and phased plan — this README covers local setup only.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
Postgres + Drizzle ORM · tRPC · Radix UI primitives · Zustand

## Local setup

```bash
npm install
docker compose up -d        # local Postgres (matches .env.example)
cp .env.example .env.local
npm run db:generate         # generate a migration from server/db/schema.ts
npm run db:migrate          # apply it
npm run dev
```

Open [http://localhost:3000/design-system](http://localhost:3000/design-system)
to review the token/component set and confirm the tRPC → Drizzle → Postgres
round trip.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run boundaries` | Enforce the hall-planner module boundary (see below) |
| `npm run db:generate` | Generate a Drizzle migration from `server/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Drizzle Studio (visual DB browser) |
| `npm run db:seed` | Seed from the legacy repo's config (Phase 2 — not yet implemented) |

## Module boundaries

`src/modules/hall-planner/geometry-source/` is the only place allowed to
import `dxf-viewer`, `dxf-parser`, or reference a `.dxf` file. Everything
else (`placement/`, `scene/`, the store) depends only on the
`FloorPlanGeometry` type exported from `geometry-source/types.ts`. This is
what lets a future native in-app floor-plan editor replace the DXF pipeline
later without touching placement or rendering code — see
`docs/ARCHITECTURE_PLAN.md` §4.3.

`npm run boundaries` (also run in CI) fails the build if this is violated.

## Project layout

```
src/
  app/                    Next.js routes
  modules/
    catalog/              venue/location browsing
    hall-planner/
      geometry-source/    DXF pipeline, isolated behind FloorPlanGeometrySource
      placement/          seating-placement algorithm
      scene/               R3F canvases
      gl-resources/        GLB loading/memory/instancing
    sharing/              share-link + realtime
  design-system/          tokens + Radix-wrapped components
  lib/                    tRPC client, cn(), generic utils
server/
  db/                     Drizzle schema, migrations, seed script
  api/                    tRPC routers
```
