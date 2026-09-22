# MARICS Security Project Status

## Product

MARICS Security is an AI-powered cybersecurity awareness and human-risk training platform. It helps individuals and organizations practice realistic responses to social-engineering situations and understand why a response was safe or risky.

The product is designed around decision practice rather than theory. Scenarios cover urgency, fear, authority, trust, scarcity, curiosity, social pressure, financial manipulation, credential theft, impersonation, phishing, banking scams, WhatsApp scams, delivery scams, job scams, and related human-risk patterns.

## Current Architecture

```text
React + Vite + TypeScript frontend
        |
        v
Fastify + TypeScript REST API
        |
        v
Supabase Auth + PostgreSQL + Row Level Security
        |
        +--> Server-side Claude adapter for Phase 3 content generation
```

The repository is a modular monolith. The frontend owns presentation, navigation, forms, and local UI state. The backend owns authentication checks, validation, business rules, risk scoring, organization authorization, audit actions, and database access. PostgreSQL is the system of record.

## Current Repository Structure

```text
frontend/
  index.html                  UTF-8 Vite document shell
  src/main.tsx                React application, routing shell, dashboards, training UI
  src/styles.css              frontend styles
  src/i18n/                   English, Afrikaans, Portuguese translations
  src/lib/api.ts              typed frontend API clients
  src/lib/supabase.ts         browser Supabase client
  public/assets/              landing-page media and logo assets

backend/
  src/server.ts               Fastify server entrypoint
  src/app.ts                  routes, auth boundary, validation, error mapping
  src/lib/supabase.ts         authenticated server Supabase client
  src/modules/assessments.ts  onboarding questions, scoring, risk profiles
  src/modules/training.ts     modules, scenarios, attempts, progress, recommendations
  src/modules/organizations.ts invitations, membership, org dashboards and reports
  src/modules/admin.ts        admin services and audited control-plane operations
  src/modules/audit.ts         audit-log service adapter
  src/modules/ai.ts            server-only Claude integration
  src/*.test.ts               route, service, and isolation tests

supabase/migrations/
  001-008                       foundation through admin control plane
  009                           explanation-rich training feedback
  010                           organization membership RLS tightening
  011                           onboarding assessment seed and category scores
  012                           audit log and admin RPCs
  013                           organization team risk and CSV reports
  014                           additive schema/policy repair for interrupted manual setup

docs/
  project-status.md            this complete product and engineering status
  development-phases.md       staged delivery plan
  architecture.md              runtime and domain architecture
  api.md                       API contract and route groups
  database.md                  tables, migrations, RLS, and data ownership
  security.md                  controls, privacy boundary, and release threats
```

## Implemented Features

### Public website

- Professional MARICS landing page with product, method, organization, security, pricing/demo call-to-action sections.
- Responsive layout and real image assets.
- English, Afrikaans, and Portuguese public-site language selection.
- Logo asset loading/error fallback and transparent dark-navbar presentation.
- UTF-8 HTML declaration at the beginning of the document head.
- Unicode/mojibake fixes and SVG sidebar icons instead of fragile raw icon characters.
- Organization feature cards use separate, feature-specific copy.

### Authentication and onboarding

- Supabase email/password authentication.
- Signup with name, email, password, country code, preferred language, and account intent.
- Email verification, sign-in, logout, and password reset through Supabase Auth.
- Actionable signup errors for duplicate email, invalid email, weak password, rate limits, and profile/database trigger failures.
- Profile creation through the Auth database trigger.
- Role-aware redirect behavior.
- New individual and employee users without a risk profile are gated into onboarding before the normal dashboard.

### User roles

The persisted four-tier role model is:

- `individual`: independent learner.
- `employee`: user attached to an organization through an invitation.
- `organization_admin`: organization manager with aggregate organization access.
- `marics_admin`: platform administrator with audited platform controls.

A signup selection does not grant administrator access. Organization administrator promotion occurs through the database-controlled organization creation flow or audited MARICS-admin action. Employee promotion occurs through a valid invitation.

### Onboarding assessment and risk profile

- Ten database-backed scenario questions.
- Categories: urgency, authority, curiosity, fear, trust, scarcity, social pressure, financial manipulation, credential theft, and impersonation.
- Assessment scenarios and options are stored in PostgreSQL.
- Server-side scoring checks the selected option against database content.
- Risk profile stores:
  - awareness score
  - strongest dimension
  - focus dimension
  - per-category `strong`/`weak` values in `category_scores`
- Dashboard displays strongest area, focus area, awareness score, and signal counts.
- Risk profile is used by the training recommendation logic.

### Individual training

- Published modules and scenarios load from PostgreSQL.
- Users can select available scenarios from the database catalog.
- Scenario content and options support language fallback: selected language, then English, then first available translation.
- Immediate answer result includes correctness, stored choice feedback, explanation, and correct option.
- Attempts persist in `training_attempts`.
- Per-user/per-module progress persists in `training_progress`.
- Dashboard displays attempted versus total scenarios by module.
- Server recommends an unfinished module matching the user's risk-profile focus area, with a next-unfinished fallback.
- Loading, empty, unavailable, and answer-save error states exist.

### Organizations

- Organization creation.
- Hashed, expiring invitation creation.
- Invitation acceptance and employee role transition.
- Organization membership checks at the service and database/RLS layers.
- Organization-admin dashboard with employee progress aggregates.
- Team risk aggregation by category.
- Highest-risk category and percentage calculation.
- JSON organization report.
- Privacy-scoped CSV report with organization completion and aggregate risk only.
- Organization admin access is checked from membership, not trusted URL parameters.

### MARICS administration

The backend control plane is protected by `requireMaricsAdmin` and database RPC checks.

Implemented backend capabilities:

- Platform overview counts and recent records.
- User search and user detail lookup.
- Role changes across the supported role enum.
- User suspend/reactivate.
- Verification resend through the server-only Supabase service role.
- Organization search, detail, creation, suspension, and org-admin assignment.
- Training catalog inspection, module update, publication, and archive/restore.
- Platform analytics for category weakness trends and completion.
- Audit-log listing.
- Platform settings for languages, AI caps, rate limits, and feature flags.

Implemented admin UI:

- Overview dashboard.
- Users panel with search, role update, suspend/reactivate.
- Organizations panel with search.
- Training catalog panel.
- Platform analytics panel.
- Audit-log panel.
- AI moderation and certificate screens remain explicit staged placeholders.

### Audit and security

- `audit_log` stores actor, action, target type, target ID, metadata, and timestamp.
- Admin mutations call the audited database/service path.
- Supabase Auth manages credentials and sessions.
- API uses Helmet, CORS configuration, rate limiting, body-size limits, and Zod validation.
- Server-only AI and service-role credentials.
- RLS and server-side membership checks protect tenant data.
- Error responses avoid exposing stack traces in production.
- Deterministic user-scoping and organization-isolation tests exist.
- Optional Supabase integration test harness is available but requires a dedicated test project and two test users.

## Partially Complete or Needs Fixing

### Organization UI

The organization API returns team risk and CSV data. The current organization screen still needs a dedicated visual team-risk panel showing:

- assessed employees
- highest-risk area
- percentage by category
- a clear not-enough-data state

The report action is wired to JSON and CSV downloads, but the risk breakdown should be made more visible in the page itself.

### Admin UI depth

The admin control-plane UI is intentionally minimal. Backend capabilities exceed the current screens. Remaining UI depth includes:

- user detail drawer/page with organization, risk profile, and training history
- organization detail page with employee and aggregate risk view
- module scenario and option CRUD, including explanation fields
- language completeness counts per module/scenario
- settings editor for AI caps, rate limits, and feature flags
- audit-log filtering and detail display

### Database deployment verification

The repository contains migrations through `202609190014_schema_repair.sql`, but the local environment does not have a usable Supabase CLI status check. The remote project must be verified separately after applying migrations. The repair migration is additive and is intended for partially applied/manual setups; it does not replace the ordered migration chain.

### Integration coverage

The default suite uses deterministic service tests and unauthenticated route tests. Full authenticated RLS integration requires:

- dedicated Supabase test project
- applied migrations
- two test users
- API URL for the running test server
- `MARICS_TEST_*` environment variables

## Not Implemented Yet

- Full scenario/module authoring CRUD for admins.
- Email delivery for organization invitations.
- Pagination for large user, organization, employee, and audit lists.
- Production deployment and domain configuration.
- HTTPS certificate and deployment automation.
- Backup/restore operations and production monitoring.
- Advanced report jobs and scheduled exports.
- Certificate eligibility rules, certificate generation, storage, verification, and downloads.
- AI-generated content user experience and moderation workflow.
- AI usage accounting, budget enforcement, and provider cost monitoring beyond the initial rate cap/configuration groundwork.
- Device security, uploads, malicious-media handling, and broader content moderation.

## Current Validation Commands

Run from the repository root:

```powershell
npm install
npm run typecheck
npm run build
npm test
```

For local development:

```powershell
npm run dev
```

Expected local URLs:

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`
- Health check: `http://localhost:4000/health`

The optional integration test is configured separately in the backend and should only be enabled against a dedicated test project.

## Migration Order

Apply all migrations in filename order:

```text
202609190001_foundation.sql
202609190002_assessments.sql
202609190003_backfill_profiles.sql
202609190004_training_seed.sql
202609190005_ai_content.sql
202609190006_organizations.sql
202609190007_auth_profiles.sql
202609190008_admin_control_plane.sql
202609190009_training_explanations.sql
202609190010_organization_access_rls.sql
202609190011_onboarding_assessment.sql
202609190012_audit_log_and_admin.sql
202609190013_org_team_risk.sql
202609190014_schema_repair.sql
```

Do not paste isolated migration excerpts into a partially initialized database. Use the Supabase migration runner or apply the complete files in order.

## Recommended Next Steps

1. Start both services and test signup, onboarding, training, admin, and organization flows manually.
2. Confirm the remote Supabase migration state and inspect the browser/API logs during signup and admin overview loading.
3. Add the organization team-risk visual panel.
4. Expand admin detail pages and training-content CRUD.
5. Run authenticated integration tests against a dedicated Supabase test project.
6. Finalize privacy rules for organization visibility of employee-level risk.
7. Only after these are stable, begin Phase 3 AI user-facing generation and cost controls.
8. Defer certification work until the readiness rule is agreed and Phase 5 begins.

## Potential Future Features

- Adaptive training paths based on risk dimensions, prior attempts, and confidence.
- Multiple scenario variants per manipulation category.
- Localized South African and regional scam libraries.
- Team campaigns and deadlines.
- Manager dashboards with privacy-preserving cohorts.
- Scheduled reports and executive summaries.
- SSO/SAML and SCIM for enterprise organizations.
- Webhook and SIEM integrations.
- Browser/mobile training surfaces.
- Phishing simulation integrations.
- Readiness certificates and public verification.
- Human-risk trend forecasting.
- Content review workflow with approvals and version history.
- Offline-friendly learning and reminder notifications.

## Product Decisions Still Required

Before production commercialization, confirm:

- Final MVP training-module list.
- Organization visibility boundary for individual risk.
- Certification readiness rule.
- Report retention and export policy.
- Invitation delivery provider.
- Hosting, deployment, backup, and monitoring provider.
- Enterprise identity requirements.
- AI budget and moderation policy.
