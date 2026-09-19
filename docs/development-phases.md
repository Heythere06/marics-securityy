# Development phases

## MVP

The first usable release includes Supabase authentication, multilingual onboarding, a database-backed assessment, deterministic risk dimensions, scenario-based training with immediate explanations, persisted progress, an individual dashboard, and the first organization membership/invitation flow. It must include authorization, RLS, loading/error/empty states, focused tests, and audit-friendly logs.

AI generation, advanced reporting, certificates, and the admin content console are post-foundation increments. They are not represented as complete by placeholder UI.

## Delivery sequence

1. Foundation: workspace, auth, roles, migrations, RLS, API conventions, and UI system.
2. Individual: onboarding, assessment, risk profile, configurable modules, training, progress, and recommendations.
3. AI: server-side provider adapter, structured output validation, caching, usage limits, and monitoring.
4. Organizations: invitations, membership, admin dashboard, aggregate risk, pagination, and report jobs.
5. Certification: configurable readiness rule, generation, storage, download, and verification.
6. Production: deployment, HTTPS, backups, monitoring, security testing, performance testing, and release QA.

Unknown business rules, especially certificate eligibility and organization visibility of individual risk, remain configurable or explicitly unresolved until confirmed.

## Phase 2 progress

The first individual-user experience is now represented in the frontend: a full-width workspace, dashboard empty states, baseline assessment interactions, risk-profile guidance, configurable module cards, and immediate scenario feedback for authority and urgency manipulation. Supabase Auth gates the workspace, assessment answers are validated and scored in the backend, and risk profiles are persisted through the authenticated API.

Training answers and module counters now persist through the authenticated API. Apply `supabase/migrations/202609190002_assessments.sql`, `202609190003_backfill_profiles.sql`, and `202609190004_training_seed.sql` in order after the foundation migration before testing the complete individual flow. The next Phase 2 increment is multilingual content and richer configurable module progression, followed by a dedicated test suite for cross-user isolation and repeated attempts.

## Phase 3 progress

The initial Claude integration is ready behind the backend: `POST /api/ai/generate-scenario` validates the request, authenticates the user, limits generation to five requests per hour, validates structured scenario output, and caches successful content in PostgreSQL. Apply `supabase/migrations/202609190005_ai_content.sql` after the training migration before using it with an authenticated account.

The provider is not called during automated tests. Remaining Phase 3 work includes a user-facing generated-scenario experience, moderation checks, usage analytics, multilingual prompt quality review, and provider failure/cost monitoring.