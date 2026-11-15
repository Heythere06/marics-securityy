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

The current repository includes database-backed onboarding assessment, risk profiles, interactive training, progress, recommendations, organizations, team-risk reports, audited admin controls, a timed 30-question certification assessment, public demo requests, SMTP/Resend invitations, opening-quiz standing levels, and **user-facing Claude AI practice** after manual module scenarios are complete. Certificates remain locked until every published training module is complete and the learner passes the certification assessment with at least 80% in 20 minutes.

Supabase migrations must be applied in filename order through `202611150002_org_admin_hardening.sql` (AI practice, CIA integrity hardening, and org-admin UPDATE/DELETE RLS plus `default_employee_language`). Do not run excerpts independently in the SQL editor. If earlier snippets were applied manually or a policy already exists, apply the repair migration before the later migrations. The admin dashboard reads its counts and recent records from the `get_admin_overview()` PostgreSQL function created by migration `202609190008_admin_control_plane.sql`.

## Supabase setup

Apply the migrations in `supabase/migrations` in filename order, including `202611020003_invitation_email_match.sql`. The admin console requires the signed-in user's profile to have the protected database role:

```sql
update public.profiles
set role = 'marics_admin', updated_at = now()
where id = (select id from auth.users where email = 'your-admin-email@example.com');
```

The role is checked by `is_marics_admin()` using the authenticated user ID; changing only user metadata will still return `403`.

Signup never grants `organization_admin`. That promotion happens only through `create_organization_for_user` after the workspace is created, or through an audited MARICS-admin action.

## Project Documentation

**Start here:** [docs/COMPLETE-SYSTEM-GUIDE.md](docs/COMPLETE-SYSTEM-GUIDE.md) — full product description, architecture, APIs, migrations, recent changes, known bugs, and ops.

Also useful:

- [docs/project-status.md](docs/project-status.md) — earlier status narrative (may lag newest features).
- [docs/development-phases.md](docs/development-phases.md) — staged delivery status.
- [docs/architecture.md](docs/architecture.md) — runtime and domain boundaries.
- [docs/api.md](docs/api.md) — authenticated API contract.
- [docs/database.md](docs/database.md) — schema, migrations, and RLS.
- [docs/security.md](docs/security.md) — security model, privacy, and release threats.
- [docs/bug-ledger.md](docs/bug-ledger.md) — launch-readiness audit (partially stale; cross-check the complete guide).
- [docs/FULL-ISSUES-INVENTORY.md](docs/FULL-ISSUES-INVENTORY.md) — exhaustive current bug/UX/security inventory (P0–P4).
