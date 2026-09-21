# Security model

## Controls

* Supabase Auth handles passwords, sessions, email verification, and reset flows. MARICS never stores plaintext passwords.
* API authorization is server-side and role-based: `individual`, `employee`, `organization_admin`, and `marics_admin`.
* Organization access is checked from authenticated membership records. Frontend checks are display-only.
* Zod validates all API input. Database constraints and RLS provide a second enforcement layer.
* Helmet-style security headers, CORS allowlisting, JSON body limits, and per-route rate limits are enabled at the API boundary.
* AI keys and the Supabase service-role key exist only in backend environment variables. AI output is schema-validated, bounded, stored, and rate-limited.
* Logs record authentication failures, authorization failures, important organization actions, and system errors without passwords, tokens, or API keys.
* The backend includes a deterministic progress-scoping test and an opt-in Supabase integration test. The integration test requires a dedicated test project and two test users; it is never run against the development project automatically.

## Threats to test before production

Cross-organization IDOR, role escalation, invitation replay, brute-force abuse, malformed AI output, report leakage, certificate enumeration, malicious uploads, XSS in generated content, and unauthorized use of service-role credentials are release blockers.

## Privacy boundary

Organization administrators receive only the minimum employee and aggregate risk information needed for their permitted workflow. Individual answers and sensitive personal information require an explicit product and privacy decision before exposure to an organization.