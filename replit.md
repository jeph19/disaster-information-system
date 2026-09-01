# Sentinel Disaster Information System

Sentinel is a municipal emergency operations workspace for recording incidents, tracking evacuation and damage assessments, and producing standard situational reports.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/disaster-information-system/src/` — React command overview, incident register, incident detail, report generator, settings, and theme.
- `artifacts/api-server/src/routes/disaster.ts` — incident, evacuation center, damage, dashboard, and situational report endpoints.
- `artifacts/api-server/src/lib/disaster.ts` — seeded starter records and operational aggregation helpers.
- `lib/db/src/schema/disaster.ts` — PostgreSQL schema for incidents, evacuation centers, and structure damage.
- `lib/api-spec/openapi.yaml` — source-of-truth API contract used to generate typed hooks and validation.

## Architecture decisions

- Operational totals are derived from evacuation center and structure damage records, so reports and dashboard numbers stay aligned with field updates.
- Situational reports are generated from current incident records at request time, with narrative sections supplied by the duty officer.
- The first-load dataset is seeded only when the development database is empty, giving the command overview useful sample data without overwriting existing records.
- The web app uses the shared API server and generated React Query hooks rather than local-only state for persistence.

## Product

- Dashboard with active incidents, evacuated population, evacuation center capacity, families, and structure impact totals.
- Searchable incident register with status filters and create/edit/delete workflows.
- Incident detail pages with per-center headcounts, demographic breakdowns, capacity utilization, and damage assessments.
- Standard SITREP generator with report metadata, operational narrative, priority needs, actions taken, next steps, and print-ready preview.
- Settings page with operator context and API health status.

## User preferences

No additional preferences recorded.

## Gotchas

- The generated Zod validators use the Zod 4 API; keep the workspace catalog on Zod 4 when regenerating the OpenAPI client.
- The web artifact expects `PORT` and `BASE_PATH` from its managed workflow; use the workflow for runtime verification rather than running Vite directly.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
