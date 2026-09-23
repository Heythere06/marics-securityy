# MARICS bug ledger

This ledger captures the issues observed during the launch-readiness audit against the live repo and the current app behavior. It is intended to be the source of truth for the remaining launch blockers and the fixes that were applied during the audit pass.

| ID | Severity | Role | Screen / route | Steps to reproduce | Expected | Actual | Suspected cause | Status |
|---|---|---|---|---|---|---|---|---|
| L-001 | P1 | marics_admin | App shell / admin navigation | Open the MARICS admin shell and inspect the sidebar. | Only production-ready admin surfaces are visible. | AI content and certificates were still in the admin navigation and route set even though they were deferred. | Deferred UI was still wired into the shell and route map. | Fixed |
| L-002 | P1 | organization_admin | Organization navigation | Open the org-admin workspace and inspect the left sidebar. | Only organization-ready destinations are present. | Certificate and AI-related surfaces appeared in the org-admin navigation. | Deferred screens were still included in the role-specific sidebar config. | Fixed |
| L-003 | P1 | all authenticated roles | App shell / placeholder routes | Navigate to the certificate view or other deferred destinations. | Deferred features should be hidden or show a clear “not available” state without being presented as production functionality. | The app exposed explicit placeholder screens and routes, which violated the launch gate requirement that no visible item should lead to a placeholder. | Placeholders remained in the route and view map without being filtered out. | Fixed |
| L-004 | P0 | individual / employee | Sign-up and auth | Sign up as an organization account and inspect the resulting profile. | A new org account should be created as `organization_admin` immediately. | The app used `account_type` but the permission logic and role checks relied on `profiles.role`, so org signups could fall back to `individual` if the trigger did not set the role. | Auth trigger inserted `account_type` without setting the actual app role. | Fixed in migration |
| L-005 | P1 | individual | Onboarding | Open the assessment flow and wait for a slow response or a failed data fetch. | The app should surface an actionable error state and retry path instead of a permanent spinner. | The flow could leave the user in a loading state if the request stalled or failed. | The onboarding fetch did not provide a strong timeout/error flow in the shell. | Improved |
| L-006 | P1 | all | Admin overview + catalog | Review the admin overview and training modules. | The dashboard should reflect only live product data and active surfaces. | The overview still surfaced counts and labels for deferred features like AI generation and certificates. | The dashboard render path reused counts that were valid in the database but not intended for launch. | Fixed |
| L-007 | P2 | all | Placeholder inventory | Browse the app shell after launch-cut. | Unimplemented items should be removed or explicitly hidden. | Deferred screens existed as visible placeholders rather than being removed. | The repo still had explicit placeholder screens wired into the UI. | Fixed |

## Placeholder inventory

The following items were explicitly deferred and removed from the active navigation and launch surfaces:

- AI generation UI and AI moderation views.
- Certificates nav entries and certificate screens.
- Any direct route that only existed as a placeholder without a production workflow behind it.

The app now keeps the functionality out of the visible UI while leaving the server-side groundwork intact.

## Regression list

The following prior bugs were already identified in project documentation and were treated as required regression checks during the launch pass:

- Admin `403` caused by relying on Auth metadata instead of the database role in `profiles.role`.
- Published training modules with no actual scenarios, creating an empty published catalog.
- Onboarding assessment failures caused by server-side RLS and scenario lookup mismatch.
- Endless “Loading your assessment” state from unbounded or failed onboarding fetches.

## Test-data and content notes

The repo includes examples such as `Sql ingections` and `sql-injection-login`, which are examples used during development and should not be treated as production content. Launch content should be explicitly reviewed, localized, and seeded only through the admin content flow before any staging/production deployment.

## Audit status

- Audit completed: yes
- Core deferred placeholders removed from the active UI: yes
- Launch-blocking app-shell issues identified and fixed in the repo: yes
- Remaining work is in the broader launch checklist, not in visible dead-product surfaces: yes
