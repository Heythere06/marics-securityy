# Development phases

## MVP

The first usable release includes Supabase authentication, multilingual onboarding, a database-backed assessment, deterministic risk dimensions, scenario-based training with immediate explanations, persisted progress, an individual dashboard, and the first organization membership/invitation flow. It must include authorization, RLS, loading/error/empty states, focused tests, and audit-friendly logs.

AI generation, certificates, production deployment, and deeper admin content CRUD remain later increments. The current repository includes the first audited admin control plane and organization aggregate reporting, but those surfaces are intentionally not presented as fully production-complete.

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

Training answers and module counters now persist through the authenticated API. Published modules and scenarios now load from PostgreSQL, users can choose an available scenario, content/options/feedback use the selected language with English fallback, the dashboard shows persisted per-module attempt progress, and risk-profile-based recommendations are returned by the progress service. Phase 2 is functionally complete for the current MVP boundary; remaining hardening is authenticated integration coverage and recommendation UX refinement.

## Phase 3 progress

The initial Claude integration is ready behind the backend: `POST /api/ai/generate-scenario` validates the request, authenticates the user, limits generation to five requests per hour, validates structured scenario output, and caches successful content in PostgreSQL. Apply `supabase/migrations/202609190005_ai_content.sql` after the training migration before using it with an authenticated account.

The provider is not called during automated tests. Remaining Phase 3 work includes a user-facing generated-scenario experience, moderation checks, usage analytics, multilingual prompt quality review, and provider failure/cost monitoring.

## Phase 4 progress

The organization backend foundation now supports organization creation, hashed expiring invitations, employee membership acceptance, admin-scoped dashboards, aggregate team progress/risk data, and reports. Apply `supabase/migrations/202609190006_organizations.sql` after the earlier migrations. The database functions enforce organization admin membership independently of URL parameters, and the API regression suite covers unauthenticated access to every organization endpoint.

The organization dashboard API now returns aggregate team-risk breakdowns and the report endpoint supports privacy-scoped CSV output. Remaining Phase 4 work is invitation delivery, paginated employee management, visual team-risk breakdowns in the org UI, privacy review of employee-level risk visibility, and authenticated cross-organization integration tests against a Supabase test project.

## Auth and user types

Migration `202609190007_auth_profiles.sql` adds persisted account intent, signup country/language metadata, and a server-side organization creation function that promotes the creator to `organization_admin`. A signup selection never grants admin access by itself. Employees become members only through a valid invitation token; individuals remain independent users. Supabase Auth provides password storage, email verification, reset links, logout, and session management.

## Language, public site, and onboarding

The frontend now has one shared translation architecture under `frontend/src/i18n/` for English, Afrikaans, and Portuguese. Language is selectable on the public site, during signup, and in the authenticated sidebar settings; authenticated changes update `profiles.preferred_language`. The signed-out experience is a public MARICS product site with product, method, feature, security, and call-to-action sections.

Onboarding now contains ten scenarios spanning urgency, fear, trust, authority, scarcity, curiosity, social pressure, financial manipulation, credential theft, and impersonation. Stable machine keys keep scoring deterministic while translated labels and scenario text remain user-facing. Answers continue to be submitted to the backend and stored in PostgreSQL.

## Role dashboards

The authenticated workspace now routes by the persisted profile role. Individuals receive personal risk, assessment, training, and recommendation views. Employees receive organization membership context and personal progress without individual answers being exposed. Organization admins land on aggregate team dashboards, invitations, and reports. MARICS admins receive a separate control-plane view with intentional empty states until audited platform-management endpoints are implemented. Invitation acceptance promotes an individual to `employee` inside PostgreSQL.

The MARICS admin control plane now has protected overview counts, recent user and organization inventories, module creation/publication controls, AI-content and certificate counts, and supported-language settings. Apply `supabase/migrations/202609190008_admin_control_plane.sql` after the previous migrations. The dashboard reads from the `get_admin_overview()` PostgreSQL function; if that function is missing, the API will report a migration prerequisite instead of presenting an indefinite loading state. Admin API access is covered by unauthenticated-route regression tests and database-side role checks.

The dashboard shell now has role-specific navigation and render guards. Individuals see personal awareness, risk, training, progress, certificates, and settings. Employees see personal learning plus limited organization context. Organization admins see organization management, reports, and configuration. MARICS admins see platform operations only. Unimplemented secondary destinations use explicit role-scoped empty states rather than showing unrelated functionality or fake data.