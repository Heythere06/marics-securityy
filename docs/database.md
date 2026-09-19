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