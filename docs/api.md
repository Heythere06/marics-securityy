# API conventions

The API is versioned under `/api` and returns JSON. Route handlers are thin; validation and domain behavior live in modules and services.

## Initial endpoint

`GET /health` returns `{ "status": "ok", "service": "marics-api" }` without requiring a database connection. This supports deployment probes while database-backed features are added.

## Planned endpoint groups

* `/api/users/me`
* `/api/organizations` and `/api/organizations/:organizationId/invitations`
* `/api/modules` and `/api/scenarios/:scenarioId/answer`
* `/api/assessments` and `/api/users/me/risk-profile`
* `/api/certificates` and `/api/certificates/verify/:verificationId`
* `/api/organizations/:organizationId/reports`
* `POST /api/scenarios/:scenarioSlug/answer` records a verified training attempt and updates the user's module progress.
* `GET /api/users/me/training-progress` returns the authenticated user's aggregate training attempts.
* `POST /api/ai/generate-scenario` asks Claude for one structured scenario and caches it by user, module, language, and prompt. It is authenticated and limited to five requests per hour.

Authenticated routes must derive the subject from the Supabase token and confirm all organization membership server-side. Public errors are stable, human-readable codes; stack traces and database messages remain server-side.