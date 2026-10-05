# MARICS launch-readiness bug ledger

Audit date: 2026-09-24. This is a repository audit, not a completed browser audit. No authenticated Supabase session, staging URL, test inbox, or Playwright harness was available in this workspace, so browser observations and performance metrics remain unverified. Findings below are based on the current source, API surface, migrations, tests, and project documentation.

| ID | Severity | Role | Screen / route | Steps to reproduce | Expected | Actual | Suspected cause | Status |
|---|---|---|---|---|---|---|---|---|
| L-001 | P0 | individual / employee | Onboarding assessment | Start a new account, refresh mid-assessment, or wait for assessment submission to fail. | Answers are locally retained, submission has a bounded retry state, and results show after one successful submit. | Answers are held only in React state; assessment submission has no loading/result screen and an error leaves the flow without a recovery model. | The shell implements a minimal sequential form rather than the specified persisted onboarding state machine. | Open |
| L-002 | P0 | all authenticated roles | Authenticated shell | Trigger a component exception or inspect session-expiry handling. | A global error boundary and 401 refresh/redirect flow preserve the return URL. | No global error boundary or centralized 401 handling is present; requests call `fetch` directly. | Auth/session handling is distributed between Supabase listeners and individual API helpers. | Open |
| L-003 | P0 | individual / employee | Training scenario | Open a scenario and answer it twice. | Four stable options, a disabled submit until selection, immediate structured result, and progress counted once per scenario. | The UI and backend previously exposed three options, submitted on selection, and incremented local progress on every attempt. | Training types and service logic were built around the older three-choice interaction and optimistic counters. | Fixed in code; staging migration/browser verification pending |
| L-004 | P0 | organization_admin | Organization dashboard / reports | Open an organization with fewer than five assessed employees and inspect team risk/report output. | A not-enough-data state is shown; reports contain aggregate data only and have explicit success/error states. | The main org dashboard shows only four aggregate metrics; team-risk rendering is not present there, report loading is an unlabelled placeholder state, and employee list/invitation lifecycle controls are incomplete. | Organization API data is not mapped to the required role-specific screen model. | Open |
| L-005 | P0 | all | Any authenticated route | Stop the API or use an expired session while a request is loading. | Every data region reaches loading, empty, error-with-retry, or success; no request spins forever. | Several calls lack `AbortSignal.timeout`, and error views such as training expose no retry button. | Timeout and retry behavior exists only on a subset of onboarding/admin helpers. | Open |
| L-006 | P1 | marics_admin | Admin navigation and control plane | Sign in as `marics_admin` and compare sidebar/routes with the release brief. | Overview, Users, Organizations, Training, Analytics, Demo requests, Audit log, Settings. | Current navigation exposes Dashboard, Users, Organizations, Training modules, Reports, and System settings; demo requests and audit log are absent, while Reports is used for analytics. | The frontend has a condensed legacy view map despite broader backend capabilities. | Open |
| L-007 | P1 | marics_admin | Users / Organizations / Audit | Search large lists and inspect mutations. | Server-side pagination, detail drawer/page, confirmation dialogs, filters, and visible audit outcomes. | Search endpoints return unpaginated arrays; role changes have no confirmation dialog; user/org detail, audit filters, and audit detail are not implemented in the UI. | API contracts and frontend screens were kept at MVP depth. | Open |
| L-008 | P1 | marics_admin | Training catalog / scenario editor | Edit or publish a scenario in the admin UI. | Four options and complete EN/AF/PT content are enforced by a server publish guard; completeness is visible per scenario/language. | The editor creates three options and only partially edits one selected language; publish guard/completeness detail is not represented in the frontend. | `AdminScenarioEditor` and `adminScenarioSchema` still use the earlier three-option model. | Open |
| L-009 | P1 | visitor | Public site / Book a Demo | Visit the public site and inspect navigation and form actions. | Every nav item lands somewhere real; demo form posts, validates, stores, alerts, and confirms. | The public navigation is a small set of anchor links plus Login; there is no Book a Demo form or public demo-request API/table. | Public-site work stopped at marketing sections and auth entry. | Open |
| L-010 | P1 | individual / employee | Dashboard / Settings | Complete onboarding, switch languages, and inspect the dashboard. | Server-computed High/Medium/Low category risk, recent activity, recommended module, and settings for language/password. | Dashboard shows only strong/weak signals and basic training totals; recent activity, category bands, password settings, and a real individual settings view are absent. | Risk profile and training APIs expose an older aggregate shape. | Open |
| L-011 | P1 | employee | Invitation acceptance | Follow an invitation as a new employee and inspect delivery/status handling. | Real localized email, hashed expiring token, resend/revoke/status list, wrong-email protection, and privacy notice. | Backend creates invitations and exposes a fallback token, but project status records email delivery as not implemented and the UI has no invitation lifecycle list or privacy acceptance notice. | Email provider integration and invitation management surface are unfinished. | Open |
| L-012 | P1 | all | Localization | Switch the public/authenticated experience to AF and PT. | All visible copy is translated or visibly marked as English fallback; no raw keys or hardcoded product strings leak. | `main.tsx` contains extensive hardcoded English labels and messages outside the translation files; no i18n completeness check exists. | i18n was applied to a subset of the public/assessment copy only. | Open |
| L-013 | P1 | all | Public and authenticated shell | Load the app at 360px and desktop widths. | Role-specific responsive shell, mobile navigation, accessible controls, and no layout breakage. | The current implementation uses one large `main.tsx` and sidebar layout; mobile behavior, keyboard/accessibility coverage, and 360px browser verification are not established. | Responsive and accessibility requirements have not been covered by automated browser tests. | Unverified |
| L-014 | P1 | deployment | Database and environments | Recreate a clean Supabase project and apply the migration chain from zero. | All migrations and approved seed content apply successfully and integration tests run against the dedicated test project. | Repository docs explicitly state the migration chain and remote history have not been proven from zero; no clean-project verification evidence exists. | No migration-runner/staging verification is available in the workspace. | Blocked on staging project |
| L-015 | P1 | all | Production content | Inspect seeded catalog before release. | Only reviewed, localized, client-approved launch scenarios are visible. | Development content such as `Sql ingections` and `sql-injection-login` is present in the documented/live development state; content status/review-pack workflow files are absent. | No versioned approved-content seed pipeline has been completed. | Open |
| L-016 | P2 | all | Performance | Measure landing, login, dashboards, scenario, and admin users with Lighthouse/network/API timing. | Baseline and after metrics are recorded against the stated targets. | No performance report or reproducible baseline is present; this environment has no staging URL/browser session to measure. | Performance work has not started with real measurements. | Blocked on staging |

## Placeholder and deferred inventory

| Surface | Current evidence | Required action |
|---|---|---|
| AI generation/moderation | Server route and frontend view-map references remain; user-facing AI generation is deferred by the brief. | Hide/remove from visible navigation; keep server adapter/rate-limit groundwork guarded. |
| Certificates | `certificates` remains in the `View` union and `CertificatesPlaceholder` exists in `main.tsx`; certificate nav is not currently in `Sidebar`. | Remove route/view exposure and keep only the one honest individual dashboard card. |
| RoleSection fallback | Non-admin unsupported views render “No records to display yet.” | Remove unsupported navigation or finish the destination; do not present this as a product page. |
| Admin Reports | Current admin Reports view is analytics, not the required report/demo-request surfaces. | Rename/map to the actual admin information architecture. |
| Help centre | Sidebar renders a button with no handler. | Remove until it has a destination or implement a real destination. |

## Required regression tests

These are required before calling Stage A stable. Existing tests cover only part of the listed behavior.

- Admin `403` must remain tied to database `profiles.role`, not Auth metadata.
- A published module with zero scenarios must not appear in the learner catalog.
- Seeded onboarding scenarios must be readable for assessment submission while answer/profile writes remain user-scoped under RLS.
- Onboarding load and submit must time out into an actionable retry state rather than an endless loading state.
- Training replay must never increase attempted progress above the unique scenario count.
- Cross-organization dashboard, employee, invitation, and report access must return 403/404 with no data.
- Aggregate reports must contain no employee names, emails, or individual answers.

## Test-data and content notes

Development examples documented in the repository include `Sql ingections` and `sql-injection-login`. They must be excluded from production unless client-approved, localized, lint-clean launch content. The repository currently has no `docs/content-status.md`, content lint, review-pack directory, or client-input log to prove that gate.

## Verification baseline

- Repository working tree: clean at audit start.
- Existing automated coverage: backend unit/route tests and opt-in integration harness; no Playwright E2E suite is present.
- Frontend/backend typecheck, build, and test commands were attempted through PowerShell but `npm.ps1` is blocked by the machine execution policy. Re-run with `npm.cmd` or an approved Node shell.
- Browser role/language/session-expiry checks: not run; no staging/test credentials or browser harness were available.
- Lighthouse, network waterfall, API p50/p95, Supabase advisors, and clean migration proof: not available.

## Audit status

Audit documentation: complete.
Code fixes: intentionally not started; the brief requires this ledger to be shown before fixes.
