# Architecture

## Runtime boundaries

```text
React frontend
    -> authenticated REST API
Fastify controllers and validation
    -> domain services
Repositories and Supabase server client
    -> PostgreSQL with Row Level Security
AI and Storage adapters (server only)
```

The frontend owns presentation, navigation, forms, and query caching. It does not calculate risk, decide authorization, call an AI provider, or write directly to PostgreSQL. The API is a modular monolith: domains are separated by modules without introducing distributed infrastructure before it is needed.

## Domain modules

The backend will grow under `src/modules/` for auth, users, organizations, assessments, training, risk, AI, certificates, reports, and admin. Each module may expose routes, schemas, services, and repositories. Cross-domain rules belong in services, not React components or route handlers.

## Request flow

1. Fastify receives the request and applies security headers, rate limits, and request-size limits.
2. Authentication middleware validates the Supabase access token.
3. Route schemas validate parameters, query values, and bodies with Zod.
4. Services load the authenticated subject and derive organization membership server-side.
5. Repositories query Supabase using scoped data access. Client-supplied organization IDs are never treated as proof of access.
6. Errors are mapped to safe public messages while details go to structured server logs.

## Storage decisions

Supabase Auth owns credentials, sessions, email verification, and password reset. Application profile and membership data live in PostgreSQL. Supabase Storage is reserved for controlled assets such as certificate files and reviewed training media. AI output is stored only after schema validation and moderation checks.

## Claude integration

Claude is called only by `backend/src/modules/ai.ts`. `AI_PROVIDER_API_KEY` is read from the server environment and is never exposed through Vite or returned by an API response. The service sends a constrained prompt, extracts JSON, validates the result with Zod, and stores valid content in `generated_content`. Repeated requests use the database cache, while the API route applies a per-client rate limit. Provider errors and malformed output become safe public messages; raw provider output is never returned.