# MARICS Security — Complete System Guide

**Last updated:** 2026-11-15  
**Branch / HEAD at write time:** `main` @ `0dc0f54`  
**Purpose:** Single source of truth for product description, architecture, features, APIs, database, recent changes, known bugs, ops, and how the app actually works today.

Related docs (older / narrower): [`project-status.md`](./project-status.md), [`architecture.md`](./architecture.md), [`api.md`](./api.md), [`database.md`](./database.md), [`security.md`](./security.md), [`bug-ledger.md`](./bug-ledger.md), [`development-phases.md`](./development-phases.md). Prefer **this file** when those conflict with current code.

---

## 1. What MARICS is

MARICS Security is a **human-risk / cybersecurity awareness** platform. People practice realistic social-engineering situations (email, SMS, WhatsApp, voice, payments, jobs, phishing), get **explainable** feedback, build a **Human Risk Profile**, and improve through module-based training.

Organizations invite employees, see **aggregate** team risk (not individual answers), and export reports. Platform admins (`marics_admin`) manage users, tenants, training content, languages, demo requests, and audit logs.

**Design principle:** decision practice under pressure — not policy quizzes.

---

## 2. Product goals (by role)

| Role | Goal |
|------|------|
| Visitor | Understand the product, book a demo, sign up / sign in |
| Individual | Opening quiz → standing → train → certificates |
| Employee | Same personal learning path, linked to an employer org |
| Organization admin | Create workspace, invite staff, dashboards, CSV/JSON reports |
| MARICS admin | Platform control plane (users, orgs, modules, analytics, audit) |

---

## 3. Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 6, TypeScript, CSS (single `styles.css`) |
| Backend | Fastify 5, Zod, TypeScript |
| Database / Auth | Supabase PostgreSQL + Supabase Auth + RLS |
| Email | Nodemailer SMTP (preferred) and/or Resend |
| AI | Anthropic Claude (`@anthropic-ai/sdk`) — practice scenarios + “ask why” |
| i18n | English, Afrikaans, Portuguese (`frontend/src/i18n/`) |
| Deploy | Vercel (frontend), Render (API) |

**Monorepo workspaces:** `frontend`, `backend` (root `package.json`).

---

## 4. Repository layout

```text
marics-securityy/
├── package.json                 # workspaces + concurrent dev/build/test
├── .env.example                 # all env vars (API + Vite)
├── vercel.json                  # Vite → frontend/dist
├── render.yaml                  # API service
├── README.md
├── docs/                        # this guide + focused docs
├── scripts/                     # migration/seed helpers (.cjs)
├── frontend/
│   ├── index.html
│   ├── vite.config.ts           # env inject + manualChunks (react, supabase)
│   ├── public/assets/           # WebP marketing assets (+ legacy images)
│   └── src/
│       ├── main.tsx             # almost entire SPA (views, dashboards, training)
│       ├── styles.css
│       ├── AdminScenarioEditor.tsx
│       ├── ScenarioInspectors.tsx
│       ├── i18n/{en,af,pt}.json
│       └── lib/{api,supabase,riskStanding}.ts
├── backend/
│   └── src/
│       ├── server.ts            # loads ../../.env, listens PORT
│       ├── app.ts               # all routes + auth + CORS + rate limits
│       ├── lib/{supabase,email,riskStanding}.ts
│       └── modules/             # assessments, training, orgs, admin, ai, …
└── supabase/migrations/         # 29 SQL migrations (apply in filename order)
```

**Important:** There is **no React Router page tree**. Navigation is `useState(view)` in `main.tsx`, plus:

- Public marketing when `!session`
- `/verify/:uuid` certificate verification via `window.location.pathname`
- Invite `?token=` / `?invite=` stored and accepted after login

---

## 5. How to run locally

### Prerequisites

- Node.js **20+**
- A Supabase project with **all** migrations applied (through `202611040002_…`)
- `.env` at repo root (copy from `.env.example`)

### Commands

```bash
npm install
npm run dev          # frontend :5173 + backend :4000
npm run build
npm run typecheck
npm run test         # backend Vitest unit tests
```

Backend integration tests (optional, needs live Supabase):

```bash
npm run test:integration --workspace backend
```

### Ports

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| API | http://localhost:4000 |
| Health | `GET http://localhost:4000/health` |

### Environment variables (from `.env.example`)

**API / server**

| Variable | Purpose |
|----------|---------|
| `NODE_ENV`, `PORT` | Runtime (default port 4000) |
| `FRONTEND_URL`, `ALLOWED_ORIGINS` | CORS (supports `https://*.vercel.app`) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | DB + Auth; service role for invites/email/preview |
| `CLAUDE_API_KEY` (or `ANTHROPIC_API_KEY` / `AI_PROVIDER_API_KEY`) | Claude |
| `AI_PROVIDER`, `AI_MODEL`, `AI_MAX_OUTPUT_TOKENS` | AI config |
| `EMAIL_PROVIDER` | `auto` \| `smtp` \| `resend` (auto prefers SMTP) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Gmail App Password works without a custom domain |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend / From header |

**Frontend (Vite)**

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Browser Auth |
| `VITE_API_URL` | API base (default `http://localhost:4000`) |

---

## 6. Architecture (runtime)

```text
Browser (React SPA)
   │  Supabase Auth (JWT)
   │  fetch(VITE_API_URL) with Bearer token
   ▼
Fastify API
   │  Zod validation, rate limits, Helmet, CORS
   │  requireUser / requireMaricsAdmin
   ▼
Supabase Postgres
   │  RLS + security-definer RPCs
   │  Auth users ↔ profiles
   ▼
Optional: SMTP/Resend (mail), Claude (AI practice / why)
```

**Privacy boundary:** organization admins see **aggregates** (completion, team risk). Individual assessment/training answers stay with the learner.

---

## 7. Roles and promotion paths

| Role | How obtained |
|------|----------------|
| `individual` | Default signup |
| `employee` | Accept organization invitation (email must match) |
| `organization_admin` | Create org via `create_organization_for_user`, or MARICS admin action — **never** from signup alone |
| `marics_admin` | Manual SQL on `profiles.role` (see README) |

Signup stores `account_type` intent (`individual` \| `organization`) in profile metadata; organization signup still requires creating a workspace before admin powers exist.

Suspend: `profiles.suspended_at` → API rejects the user.

---

## 8. End-to-end user journeys

### 8.1 Visitor → account

1. Land on public site (hero, why, method, orgs, demo, get started).
2. Login / Sign up (Supabase).
3. Verify email (Supabase + optional `POST /api/auth/resend-verification`).
4. Session loads profile → workspace shell.

### 8.2 Opening quiz (mandatory for non–marics_admin)

1. If no `risk_profiles` row → `needsOnboarding = true`.
2. Sidebar locks everything except Assessment.
3. Ten scenarios (dimensions: urgency, authority, curiosity, fear, trust, scarcity, social pressure, financial manipulation, credential theft, impersonation).
4. Submit → `awareness_score`, `focus_dimension`, `strongest_dimension`, `category_scores` strong/weak.
5. UI standing bands via `riskStanding.ts`: Critical → Elevated → Moderate → Guarded → Resilient.
6. Primary CTA: practice focus area / recommended module.

Progress mid-quiz: `sessionStorage` key `marics_onboarding_${userId}`.

### 8.3 Training

1. Published modules with ≥1 scenario appear in catalog.
2. Learning material (why / warning signs / safer practice).
3. Scenario chooser grid (manual + AI practice tiles).
4. Inspect-before-answer (`ScenarioInspectors`) for rich channels.
5. Four options A–D; feedback + explanation; optional AI “ask why” (rate-limited).
6. Progress / recommendations from `/api/users/me/training-progress`.
7. After **all manual scenarios** in a module: unlock Claude AI practice generation.

### 8.4 Certificates

1. Complete all published modules’ manual scenarios.
2. Pass 30-question timed certification (≥80%, 20 minutes).
3. Module certificates appear; public verify at `/verify/:verificationId`.

### 8.5 Organization admin

1. Create organization → becomes `organization_admin`.
2. Invite employees by email → SMTP/Resend + magic/invite link.
3. Dashboard: members, aggregate metrics, team risk (threshold messaging).
4. Reports: JSON + CSV export.
5. Settings: org rename merged into personal Settings page.

### 8.6 Employee invite

1. Preview invite (public, by token).
2. Sign in with **matching** email.
3. Accept → role `employee`, membership.
4. Same quiz gate as individuals.

### 8.7 MARICS admin

Overview cards, users, orgs, modules publish, languages, demo requests, audit, analytics, scenario editor (lazy-loaded).

---

## 9. Frontend surfaces (views)

`View` union in `main.tsx`:

`overview` | `assessment` | `training` | `organization` | `certificates` | `progress` | `users` | `modules` | `ai-content` | `reports` | `settings` | `audit` | `demo-requests` | `help`

| Surface | Who |
|---------|-----|
| PublicSite | Unauthenticated |
| AuthScreen | Sign-in / up / reset |
| Overview / EmployeeDashboard / OrganizationDashboard / PlatformAdminDashboard | Role overview |
| RiskProfileView / AssessmentView | Opening quiz + standing |
| ModuleTrainingView | Training + AI practice |
| ProgressView | Standing + modules + recommendation CTA |
| CertificatesView | Certs + certification exam |
| OrganizationWorkspace / Reports / Settings | Org admin |
| HelpCentre | All authenticated |
| AdminSecondaryView + AdminScenarioEditor | marics_admin |

---

## 10. Backend API (complete route list)

Auth: `Authorization: Bearer <supabase_access_token>` unless noted.

### Public / light auth

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| POST | `/api/demo-requests` | Public demo form |
| POST | `/api/auth/resend-verification` | Resend verify email (rate limited) |
| GET | `/api/organizations/invitations/preview` | Invite preview by token |
| GET | `/api/certificates/verify/:verificationId` | Public cert verify |

### Profile / assessment / training

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/users/me` | Profile |
| PATCH | `/api/users/me` | Name / language |
| GET | `/api/assessment/onboarding` | 10 quiz scenarios |
| POST | `/api/assessments` | Submit quiz → risk profile |
| GET | `/api/users/me/risk-profile` | HRP |
| GET | `/api/training/modules` | Published learner catalog |
| GET | `/api/training/scenarios/:scenarioSlug` | Scenario detail |
| POST | `/api/scenarios/:scenarioSlug/answer` | Training attempt |
| GET | `/api/users/me/training-progress` | Progress + recommendation |
| GET/POST | `/api/training/modules/:moduleSlug/ai-practice` | List / generate AI practice |
| GET | `/api/training/ai-practice/:scenarioSlug` | AI scenario |
| POST | `/api/training/ai-practice/:scenarioSlug/answer` | AI answer |
| POST | `/api/ai/scenario-why` | Bounded follow-up explanation |
| POST | `/api/ai/generate-scenario` | Admin-style AI draft (rate limited) |
| GET | `/api/certificates` | List (certification-gated) |
| POST | `/api/certification-assessment/start` | Start exam |
| POST | `/api/certification-assessment/submit` | Submit exam |

### Organizations

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/organizations` | List memberships / create |
| PATCH | `/api/organizations/:organizationId` | Update |
| POST | `/api/organizations/:organizationId/invitations` | Invite + email |
| GET | `/api/organizations/invitations/validate` | Validate invite |
| POST | `/api/organizations/invitations/accept` | Accept |
| DELETE | `/api/organizations/:organizationId/members/:userId` | Remove member |
| GET | `/api/organizations/:organizationId/dashboard` | Org dashboard |
| POST | `/api/organizations/:organizationId/reports` | JSON or CSV |

### MARICS admin

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/overview` | Counts |
| GET | `/api/admin/demo-requests` | Demo inbox |
| CRUD-ish | `/api/admin/modules`, `/scenarios`, publish, catalog, archive | Training CMS |
| GET/PATCH | `/api/admin/users…` | Search, role, suspend, resend verify |
| GET/POST/PATCH | `/api/admin/organizations…` | Tenants, suspend, assign admin |
| GET | `/api/admin/analytics`, `/audit-log` | Platform insight |
| PATCH | `/api/admin/settings` | e.g. languages |

More narrative detail: [`api.md`](./api.md).

---

## 11. Database & migrations

Apply **all** files in `supabase/migrations/` in **filename order**. Do not paste excerpts out of order.

| Migration | Purpose |
|-----------|---------|
| `202609190001_foundation.sql` | Core schema, roles, RLS helpers |
| `202609190002_assessments.sql` | Assessments, risk_profiles, progress |
| `202609190003_backfill_profiles.sql` | Backfill profiles from auth.users |
| `202609190004_training_seed.sql` | Initial module/scenario seed |
| `202609190005_ai_content.sql` | generated_content |
| `202609190006_organizations.sql` | Invites + org RPCs |
| `202609190007_auth_profiles.sql` | handle_new_user, create org for user |
| `202609190008_admin_control_plane.sql` | platform_settings, is_marics_admin, overview |
| `202609190009_training_explanations.sql` | Rich option feedback |
| `202609190010_organization_access_rls.sql` | Membership SELECT split |
| `202609190011_onboarding_assessment.sql` | 10-scenario quiz + category_scores |
| `202609190012_audit_log_and_admin.sql` | Audit + admin search/suspend |
| `202609190013_org_team_risk.sql` | Team risk + CSV RPC |
| `202609190014_schema_repair.sql` | Idempotent repair |
| `202609190015_admin_scenarios.sql` | Published read + admin scenarios |
| `202609190016_organization_member_activity.sql` | Email + activity fields |
| `202609190017_training_four_options.sql` | A–D options, progress rules |
| `202609300001_user_module_certificates.sql` | Unique cert per user/module |
| `202610050001_training_learning_material.sql` | Learning material JSON |
| `202610050002_sql_injection_scenarios.sql` | Extra scenarios |
| `202610070001_ai_scenario_followup_limits.sql` | AI why rate limits |
| `202610070002_training_completion_integrity.sql` | Completion = all scenarios |
| `202610070003_phishing_scenarios.sql` | Namibia phishing seeds |
| `202610230001_certification_assessment.sql` | Certification tables |
| `202611020001_signup_role_and_demo_requests.sql` | Safe signup + demo_requests |
| `202611020002_human_risk_training_modules.sql` | Six human-risk modules |
| `202611020003_invitation_email_match.sql` | Invite email must match |
| `202611040001_ai_practice_scenarios.sql` | Per-user AI practice tables |
| `202611040002_fix_invitation_pgcrypto.sql` | pgcrypto extension path for invites |

Promote platform admin:

```sql
update public.profiles
set role = 'marics_admin', updated_at = now()
where id = (select id from auth.users where email = 'your-admin-email@example.com');
```

Helper script: `scripts/apply-ai-practice-migration.cjs`.

---

## 12. Domain concepts

### Human Risk Profile (HRP)

Stored in `risk_profiles`. Built from opening quiz scoring in `backend/src/modules/assessments.ts`:

- `awareness_score` 0–100 (% correct)
- `focus_dimension` / `strongest_dimension`
- `category_scores` map of dimension → `strong` \| `weak`

### Standing (UI)

`backend/src/lib/riskStanding.ts` and `frontend/src/lib/riskStanding.ts` map score → level label, vulnerability wording, summary copy. Also topic exposure from weak-count.

### Training recommendation

Progress service suggests a module (`focus-area` or `next-unfinished`) used by Overview, Progress, and post-quiz CTAs.

### AI practice

After manuals complete for a module, Claude generates fresh scenarios stored per user. Slugs typically `ai-practice-…`. Answers update attempts/history separately from catalog manuals.

### Email

`backend/src/lib/email.ts`: SMTP first in `auto` mode. Used for org invitations and custom verification resend. Invite create has service-role / Node crypto fallback if DB `gen_random_bytes` / search_path fails (see migration `202611040002`).

### Certification gate

Certificates API refuses listing until the 30Q certification assessment is passed after full catalog completion.

---

## 13. Recent change history (high signal)

| Commit | What landed |
|--------|-------------|
| `7c0fad5` | AI practice, SMTP invites, opening-quiz standing, workspace polish, org settings merge, help/progress/cert CTAs |
| `e53fed2` | Public site: WebP assets, consolidated CSS, brand-first hero, Get started (not fake Pricing), i18n/demo form, Vite chunks |
| `fde4789` | Training UX: scenario/AI chooser grids, module card tones, **sorted scenario titles**; large CSS for chooser |
| `0dc0f54` | Merge fix bringing marketing + training UI lines together on `main` |

### Pull review notes (2026-11-15)

Pulled `e53fed2` → `0dc0f54`. Meaningful delta beyond marketing:

1. **Backend** `listPublishedModules` sorts scenarios by localized title (stable UX).
2. **Frontend** replaced `<select>` scenario picker with accessible button grids for manuals and AI practice.
3. **CSS** +245 lines for `scenario-chooser`, tone classes (`tone-0`…), training polish.
4. Overview module cards use a 6-tone palette.

---

## 14. Tests

| File | Covers |
|------|--------|
| `backend/src/app.test.ts` | Health |
| `lib/riskStanding.test.ts` | Standing thresholds |
| `lib/email.test.ts` | Email HTML builders |
| `modules/assessments.test.ts` | Quiz scoring |
| `modules/training.test.ts` | Explanations, progress, access, certificates rules |
| `modules/organizations.test.ts` | Org isolation |
| `modules/ai.test.ts` | Follow-up limits |
| `modules/aiPractice.test.ts` | Manual-complete gate |
| `training.integration.test.ts` | Live Supabase (skipped if unconfigured) |

**No frontend automated tests.** No Playwright E2E in repo.

---

## 15. Deployment

### Frontend (Vercel)

- Root `vercel.json`: build `npm run build`, output `frontend/dist`.
- Set `VITE_SUPABASE_*`, `VITE_API_URL` to production API.

### Backend (Render)

- `render.yaml`: `rootDir: backend`, build + `npm run start`, `PORT` 10000.
- Secrets: Supabase, Claude, SMTP/Resend, `FRONTEND_URL`, `ALLOWED_ORIGINS`.

### CORS

Production origins from `FRONTEND_URL` + `ALLOWED_ORIGINS` (wildcard Vercel patterns supported in `app.ts`).

---

## 16. Known bugs, debt, and “still buggy” areas

The app is **feature-rich but uneven**. Treat the following as the current honesty list (supersedes stale parts of `bug-ledger.md` where noted).

### Still open / high friction

1. **Monolithic `main.tsx`** — hard to maintain; bugs and regressions cluster here.
2. **Incomplete i18n** — large authenticated UI still hardcoded English (settings, training chrome, admin).
3. **Admin depth** — users/orgs lists lack pagination, confirmations, rich detail drawers; scenario editor lag vs 4-option / EN-AF-PT publish rules.
4. **Timeouts / retry** — not every API call uses AbortSignal + retry UI (partially improved for quiz/training).
5. **Content quality** — seed/dev scenarios (e.g. SQL-injection style) may still appear unless curated for production.
6. **Clean migration proof** — full zero-to-one Supabase apply not proven in CI; ops must apply full chain carefully.
7. **No E2E** — role flows (invite, quiz gate, certification, AI practice) are manual.
8. **Bug ledger staleness** — L-011 invitation email is largely **done** now; L-010 settings/password partly done; AI practice is **live** (ledger still talks about hiding AI). Re-audit before release.
9. **Certificate / certification UX** — multi-step gate can feel opaque when errors only say “30-question”.
10. **Email deliverability** — Gmail SMTP works for demos; production needs verified domain (Resend) for reliability.
11. **Invite edge cases** — wrong email, expired token, pgcrypto/search_path (mitigated but environment-dependent).
12. **Performance** — JS still large for anonymous users (chunks help; full app still in one SPA). Legacy multi-MB images may remain beside WebP.

### Working well (relative)

- Opening quiz gate + standing UI
- SMTP invite path + email match accept
- Training inspect → answer → feedback → AI practice unlock
- Org aggregate dashboards / CSV
- Public marketing site after WebP + CSS consolidation
- Scenario chooser grid (post-`fde4789`)

---

## 17. Suggested debugging checklist when “the app is buggy”

1. Confirm migrations through **`202611040002`** on the linked Supabase project.
2. Confirm `.env` / Vercel / Render env parity (`VITE_API_URL`, CORS origins, service role).
3. `GET /health` and browser Network tab for 401/403/500.
4. Profile role + `risk_profiles` presence for quiz lock.
5. Email: server boot logs for SMTP/Resend readiness; App Password vs Resend domain.
6. Training empty: modules published **and** have scenarios; RLS published policies.
7. AI practice: Claude key present; manuals complete for that module.
8. Certificates: all modules complete + certification pass.

---

## 18. Recommended next engineering priorities

1. Split `main.tsx` into route/feature modules; add React Router or keep view map but isolate files.
2. Frontend Vitest + Playwright happy paths (signup → quiz → train → invite accept).
3. Refresh `bug-ledger.md` against current code; close fixed items.
4. Admin scenario editor aligned to 4 options + EN/AF/PT publish guard.
5. Harden API timeouts + empty/error/retry everywhere.
6. Production content pack + remove unapproved seed scenarios.
7. Further code-split: lazy `WorkspaceApp` so marketing visitors don’t download admin/training UI.
8. Keep README migration cutoff updated past `202611040002`.

---

## 19. File quick-reference (where to change what)

| Concern | Primary files |
|---------|----------------|
| Landing / auth UI | `frontend/src/main.tsx` (`PublicSite`, `AuthScreen`), `styles.css`, `i18n/*.json` |
| Quiz / standing | `backend/modules/assessments.ts`, `lib/riskStanding.ts`, frontend RiskProfileView |
| Training / AI practice | `backend/modules/training.ts`, `aiPractice.ts`, `ai.ts`, ModuleTrainingView |
| Orgs / invites / email | `backend/modules/organizations.ts`, `lib/email.ts`, `authEmail.ts` |
| Certificates | `backend/modules/certificates.ts`, `certification.ts` |
| Admin | `backend/modules/admin.ts`, PlatformAdminDashboard, AdminScenarioEditor |
| Routes | `backend/src/app.ts` |
| Schema | `supabase/migrations/*` |

---

## 20. Glossary

| Term | Meaning |
|------|---------|
| HRP | Human Risk Profile — scored opening quiz result |
| Standing | Named vulnerability band from awareness score |
| Manual scenarios | Authored catalog scenarios (required before AI practice) |
| AI practice | Claude-generated per-user scenarios after manuals |
| Certification assessment | Timed 30Q gate before certificate listing |
| Org aggregate | Team stats without individual answers |
| MARICS admin | Platform operator role in `profiles.role` |

---

*End of complete system guide. Update this file whenever migrations, major routes, or product gates change.*
