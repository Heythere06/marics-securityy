# Database and RLS

The initial migration establishes the identity, tenancy, training-content, and progress primitives. Every table uses UUID keys and UTC timestamps. Authenticated identity is linked to `auth.users`; application authorization is derived from `organization_memberships` and the `profiles.role` value.

## Core relationships

* A profile represents one authenticated user.
* An organization has many memberships. A user can belong to multiple organizations, but only an owner/admin can manage an organization.
* Modules contain scenarios, and scenarios contain answer options.
* Attempts belong to a user and scenario; progress is a per-user/per-module aggregate maintained by trusted backend code.
* Certificates reference a user and optional module and have a public verification ID that is not an authorization credential.

## Tenant isolation

RLS is enabled on tenant-sensitive tables. Policies use `security definer` helper functions to check the current user's membership rather than trusting URL or body parameters. The service role is restricted to the backend and bypasses RLS only for explicitly audited administrative jobs.

Production policy changes must be applied through reviewed migrations. Add indexes for membership lookups, scenario/module joins, attempts by user, and certificate verification.

Phase 4 adds `organization_invitations` and PostgreSQL security-definer functions for invitation acceptance, admin dashboard aggregation, and reports. These functions verify `auth.uid()` and organization admin membership inside the database. Apply `202609190006_organizations.sql` after the AI migration. The raw invitation token is returned only once to the authenticated inviter so an email provider can be added later without storing reusable invitation secrets.

Apply `202609190007_auth_profiles.sql` after the organization migration. It extends profiles with account intent and updates the Auth trigger to persist country and preferred language metadata. It also creates the only role-promotion path for organization administrators.

The current migration sequence ends at `202609190007_auth_profiles.sql`. The assessment API requires ten answers; existing assessment rows remain compatible because answer count is enforced by the validated API contract rather than a database row-count constraint.

The same migration redefines invitation acceptance to set the authenticated user's role to `employee`. This update occurs only after a valid, unexpired, hashed invitation token is consumed; users cannot assign themselves an employee or administrator role from the frontend.