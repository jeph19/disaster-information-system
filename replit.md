# Sentinel Disaster Information System

Sentinel is a municipal emergency operations workspace for recording incidents, tracking evacuation and damage assessments, and producing standard situational reports.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `FIREBASE_PROJECT_ID=sentinel-9fdc4`
- Required env: `GOOGLE_APPLICATION_CREDENTIALS` — path to an application-default-credentials JSON file (do not commit or expose the file)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: Firebase Cloud Firestore via `firebase-admin`
- Validation: Zod (`zod/v4`)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/disaster-information-system/src/` — React command overview, incident register, incident detail, report generator, settings, and theme.
- `artifacts/api-server/src/routes/disaster.ts` — incident, evacuation center, damage, dashboard, and situational report endpoints.
- `artifacts/api-server/src/lib/disaster.ts` — seeded starter records and operational aggregation helpers.
- Firestore collections `disaster_incidents`, `disaster_evacuation_centers`, and `disaster_structure_damages` store disaster records; numeric IDs are persisted in each document.
- `disaster_audit_logs` stores immutable before/after snapshots for operational changes; `disaster_incident_photos` stores incident photo metadata while image files live in Firebase Storage.
- Firebase Storage must be enabled for the configured Firebase project. Deploy both `firestore.rules` and `storage.rules` before using audit history or incident photo uploads.
- `lib/api-spec/openapi.yaml` — source-of-truth API contract used to generate typed hooks and validation.

## Architecture decisions

- Operational totals are derived from evacuation center and structure damage records, so reports and dashboard numbers stay aligned with field updates.
- Situational reports are generated from current incident records at request time, with narrative sections supplied by the duty officer.
- A generated SITREP includes the incident’s photos available at generation time; regenerate the report after adding or removing photos.
- Operational writes and audit snapshots are committed together, with audit event times assigned by Firestore. The client-side audit trail is append-only under Firestore rules.
- The first-load dataset is seeded only when the development database is empty, giving the command overview useful sample data without overwriting existing records.
- The frontend uses Firebase Authentication, Firestore, and Firebase Storage directly for shared operational data and incident media.

## Product

- Dashboard with active incidents, evacuated population, evacuation center capacity, families, and structure impact totals.
- Searchable incident register with status filters and create/edit/delete workflows.
- Incident detail pages with per-center headcounts, demographic breakdowns, capacity utilization, and damage assessments.
- Incident photo gallery and per-incident change history with actor, server timestamp, and before/after snapshots.
- Standard SITREP generator with report metadata, operational narrative, incident photos, priority needs, actions taken, next steps, and print-ready preview.
- Settings page with operator context and API health status.

## User preferences

No additional preferences recorded.

## Gotchas

- The generated Zod validators use the Zod 4 API; keep the workspace catalog on Zod 4 when regenerating the OpenAPI client.
- The web artifact expects `PORT` and `BASE_PATH` from its managed workflow; use the workflow for runtime verification rather than running Vite directly.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
