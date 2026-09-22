## Supabase setup

Apply the migrations in `supabase/migrations` in filename order, including `202609190015_admin_scenarios.sql`. The admin console requires the signed-in user's profile to have the protected database role:

```sql
update public.profiles
set role = 'marics_admin', updated_at = now()
where id = (select id from auth.users where email = 'your-admin-email@example.com');
```

The role is checked by `is_marics_admin()` using the authenticated user ID; changing only user metadata will still return `403`.

# MARICS Security

MARICS is a cybersecurity awareness and human-risk training platform. It uses realistic social-engineering scenarios, explainable answer feedback, risk profiles, personalized training recommendations, organization-level human-risk insight, and an audited platform administration layer.

## Repository layout

```text
frontend/  React + Vite + TypeScript client
backend/   Fastify + TypeScript REST API
supabase/  PostgreSQL migrations, RPCs, seed content, and RLS policies
docs/      architecture, API, security, and delivery decisions
```

## Local development

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and provide Supabase values when database features are enabled.
3. Run `npm install`.
4. Run `npm run dev`.

The frontend runs on `http://localhost:5173` and the API on `http://localhost:4000`. The API health check is `GET /health`.

The current repository includes database-backed onboarding assessment, risk profiles, training, progress, recommendations, organizations, team-risk reports, audited admin controls, and a server-side AI adapter. AI generation remains a later product phase and is not yet a complete user-facing workflow.

Supabase migrations must be applied in filename order through `202609190015_admin_scenarios.sql` for the current authentication, individual, employee, organization-admin, MARICS-admin, onboarding, audit, organization-risk, and localized scenario-authoring flows. Do not run excerpts independently in the SQL editor. If earlier snippets were applied manually or a policy already exists, apply the repair migration before `202609190015_admin_scenarios.sql`. The admin dashboard reads its counts and recent records from the `get_admin_overview()` PostgreSQL function created by migration `202609190008_admin_control_plane.sql`.

## Project Documentation

Read [docs/project-status.md](docs/project-status.md) for the complete project description, current structure, implemented features, incomplete work, migration order, validation commands, next steps, potential features, and outstanding product decisions.

Additional documentation:

- [docs/development-phases.md](docs/development-phases.md) — staged delivery status.
- [docs/architecture.md](docs/architecture.md) — runtime and domain boundaries.
- [docs/api.md](docs/api.md) — authenticated API contract.
- [docs/database.md](docs/database.md) — schema, migrations, and RLS.
- [docs/security.md](docs/security.md) — security model, privacy, and release threats.