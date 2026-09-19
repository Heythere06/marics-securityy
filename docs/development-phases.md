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