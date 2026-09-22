# API conventions

The API is versioned under `/api` and returns JSON. Route handlers are thin; validation and domain behavior live in modules and services.

## Initial endpoint

`GET /health` returns `{ "status": "ok", "service": "marics-api" }` without requiring a database connection. This supports deployment probes while database-backed features are added.

## Endpoint groups

* `/api/users/me`
* `/api/organizations` and `/api/organizations/:organizationId/invitations`
* `/api/modules` and `/api/scenarios/:scenarioId/answer`
* `/api/assessments` and `/api/users/me/risk-profile`
* `/api/certificates` and `/api/certificates/verify/:verificationId`
* `/api/organizations/:organizationId/reports`
* `POST /api/scenarios/:scenarioSlug/answer` records a verified training attempt and updates the user's module progress.
* `GET /api/training/modules` returns published modules and their available scenario slugs for the authenticated user.
* `GET /api/training/scenarios/:scenarioSlug` returns a published scenario, localized content, options, risk dimensions, and stored feedback.
* `GET /api/users/me/training-progress` returns the authenticated user's aggregate attempts plus persisted per-module attempts, correct answers, scenario counts, and completion state.
* `POST /api/ai/generate-scenario` asks Claude for one structured scenario and caches it by user, module, language, and prompt. It is authenticated and limited to five requests per hour.
* `POST /api/organizations` creates an organization and makes the authenticated creator its admin.
* `POST /api/organizations/:organizationId/invitations` creates a hashed, expiring invitation for an admin-managed organization.
* `POST /api/organizations/invitations/accept` accepts an invitation for the authenticated user.
* `GET /api/organizations/:organizationId/dashboard` returns scoped aggregate employee progress and risk data.
* `POST /api/organizations/:organizationId/reports` generates a scoped organization report; pass `{ "format": "csv" }` for a downloadable aggregate CSV with no employee names or individual answers.
* `PATCH /api/users/me` updates the authenticated user's preferred language.
* `GET /api/admin/overview` returns protected platform counts and recent users, organizations, modules, and AI content for `marics_admin` users.
* `POST /api/admin/modules` and `PATCH /api/admin/modules/:moduleId` create and publish configurable training modules.
* `PATCH /api/admin/settings` updates the supported platform languages for `marics_admin` users.
* `GET /api/admin/users` and `GET /api/admin/users/:userId` provide protected user search/detail access.
* `PATCH /api/admin/users/:userId/role` changes a role through the audited admin service.
* `PATCH /api/admin/users/:userId/suspended` suspends or reactivates an account.
* `POST /api/admin/users/:userId/resend-verification` requests a server-side verification resend.
* `GET /api/admin/organizations` and `GET /api/admin/organizations/:organizationId` provide organization search/detail access.
* `POST /api/admin/organizations` creates an organization through the audited admin path.
* `PATCH /api/admin/organizations/:organizationId/suspended` suspends or reactivates an organization.
* `PATCH /api/admin/organizations/:organizationId/admins` assigns or removes an organization administrator.
* `GET /api/admin/training/catalog` returns module and language-completeness data.
* `PATCH /api/admin/training/modules/:moduleId` updates module content/publication.
* `PATCH /api/admin/training/modules/:moduleId/archive` archives or restores a module.
* `GET /api/admin/analytics` returns platform-wide weakness and completion aggregates.
* `GET /api/admin/audit-log` returns the protected admin audit trail.
* `GET /api/assessment/onboarding` returns the ten authenticated onboarding scenarios.
* `GET /api/users/me/risk-profile` returns the authenticated user's stored risk profile.

Authenticated routes must derive the subject from the Supabase token and confirm all organization membership server-side. Public errors are stable, human-readable codes; stack traces and database messages remain server-side.