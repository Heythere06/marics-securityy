# MARICS Security

MARICS is a cybersecurity awareness and human-risk training platform. This repository starts as a modular monolith with a React client, a Node REST API, and Supabase/PostgreSQL as the system of record.

## Repository layout

```text
frontend/  React + Vite + TypeScript client
backend/   Fastify + TypeScript REST API
supabase/  PostgreSQL migrations and RLS policies
docs/      architecture, API, security, and delivery decisions
```

## Local development

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and provide Supabase values when database features are enabled.
3. Run `npm install`.
4. Run `npm run dev`.

The frontend runs on `http://localhost:5173` and the API on `http://localhost:4000`. The API health check is `GET /health`.

The first release intentionally does not pretend that assessments, organizations, or AI generation are complete. Those domains are documented and will be added phase by phase with database-backed tests and authorization.

Supabase migrations must be applied in filename order through `202609190008_admin_control_plane.sql` for the current authentication, individual, employee, organization-admin, and MARICS-admin flows. The admin dashboard reads its counts and recent records from the `get_admin_overview()` PostgreSQL function created by migration `202609190008_admin_control_plane.sql`.

## Delivery status

Phase 1 foundation is in progress. See [docs/development-phases.md](docs/development-phases.md) for the MVP boundary and sequencing.