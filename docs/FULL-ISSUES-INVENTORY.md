# MARICS Security — Full Issues Inventory

**Audit date:** 2026-11-15  
**Scope:** Frontend, backend API, RLS/migrations, UX, accessibility, i18n, ops, polish  
**Method:** Static code review of current `main` (evidence-based; not a live browser E2E pass)  
**Total findings:** **102** (60 frontend + 42 backend)

### Batch 1 status (CIA integrity) — landed

| ID | Status |
|----|--------|
| BE-001 cert `isCorrect` leak | **Fixed** in API (`toPublicQuestions`) |
| BE-002 options answer-key RLS | **Migration** `202611150001_cia_integrity_hardening.sql` |
| BE-003 self role escalation | **Migration** profile privilege guard + admin/invite bypass |
| BE-004/005/006 forge progress/certs | **Migration** read-only learner policies; writes via service role |
| BE-007/008 invite token in HTTP | **Fixed** — tokens email-only; dashboard no longer shows links |
| BE-009 AI practice answer JSON | **Migration** + API stores `correct_option_key` / `option_feedback` server-side |

**Migration applied** on Supabase (`202611150001_cia_integrity_hardening.sql`).

### Batch 2 status (Auth & onboarding) — landed

| ID | Status |
|----|--------|
| FE-001 session expiry → sign-in | **Fixed** — expired sessions open AuthScreen with notice |
| FE-002 final quiz save race | **Fixed** — save succeeds before advancing final answer |
| FE-003 invite error blocks sign-in | **Fixed** — only sign-up is disabled on invalid invite |
| FE-009 corrupt onboarding storage | **Fixed** — try/catch + clear bad `sessionStorage` |

### Batch 3 status (Org admin) — landed in repo

| ID | Status |
|----|--------|
| BE-013 `default_employee_language` | **Migration** `202611150002_org_admin_hardening.sql` |
| BE-014 organizations UPDATE RLS | **Migration** `organizations_admin_update` |
| BE-012 / BE-035 member remove | **Migration** DELETE policy + `remove_organization_member` RPC (self/last-admin guards) |
| FE-036 remove member UI | **Fixed** — Remove control on employee rows |
| FE-010 invite token UI | **Fixed** — email-only invites; join paste field masked |

**Apply migration** `202611150002_org_admin_hardening.sql` on Supabase.

### Batch 4 status (Certification UX) — landed in repo

| ID | Status |
|----|--------|
| FE-004 timer dead-end | **Fixed** — auto-submit if complete; otherwise Start new attempt |
| FE-032 stringly gate | **Fixed** — `CERTIFICATION_REQUIRED` via `ApiError.code` |
| FE-031 hardcode 80%/30Q | **Fixed** — bind `gate` / assessment `passPercent` + `timeLimitMinutes` |
| BE-036 already submitted | **Fixed** — maps to HTTP 409 |

### Batch 5 status (Training honesty) — landed in repo

| ID | Status |
|----|--------|
| FE-023 inspect reset during render | **Fixed** — reset via `useEffect` on slug |
| FE-024 SMS inspect on mount | **Fixed** — require sender + flagged interaction |
| FE-025 WhatsApp one-step unlock | **Fixed** — unlock only at conversation `end` |
| FE-027 next wraps into AI | **Fixed** — separate manual / AI next queues |
| FE-028 AI stale on navigate | **Fixed** — AbortController on scenario change / leave training |

### Batch 6 status (i18n / mobile / a11y) — landed in repo

| ID | Status |
|----|--------|
| FE-019 opening quiz chrome | **Fixed** — `assessment.opening*` i18n keys |
| FE-026 inspector hints | **Fixed** — `inspect` strings + `language` prop |
| FE-033 cert verify title | **Fixed** — locale-aware module title |
| FE-035 progress titles | **Fixed** — `title[language]` |
| FE-046 mobile sign-out | **Fixed** — keep `.side-bottom` visible |
| FE-047 profile name zeroed | **Fixed** — abbreviated name stays readable |
| FE-048 reduced-motion | **Fixed** — smooth scroll only if `no-preference` |
| FE-049 / FE-022 a11y | **Fixed** — progressbar roles + option `type`/`aria-pressed` |
| FE-057 HelpCentre | **Fixed** — localized help copy |

### Batch 7 status (Ops / hosting) — landed in repo

| ID | Status |
|----|--------|
| FE-005 `/verify/*` SPA 404 | **Fixed** — Vercel rewrites to `index.html` |
| BE-025 prod CORS localhost default | **Fixed** — `CORS_ORIGINS_REQUIRED` fail-fast |
| BE-039 cert verify rate limit | **Fixed** — 40 requests / hour on public verify |

### Batch 8 status (Cert integrity + AI quota) — landed in repo

| ID | Status |
|----|--------|
| BE-015 start/submit question mismatch | **Fixed** — `question_ids` bound at start |
| BE-016 unlimited open assessments | **Fixed** — reuse active or expire others |
| BE-017 AI why burns quota on failure | **Fixed** — `refund_ai_followup_request` after Claude errors |
| BE-018 risk_profiles self-write | **Already fixed** in Batch 1 read-only RLS |

**Apply migration** `202611150003_cert_binding_and_ai_refund.sql` on Supabase.

### Batch 9 status (Invite integrity + admin safety) — landed in repo

| ID | Status |
|----|--------|
| BE-010 accept invite race | **Fixed** — claim invitation before membership; pgcrypto-only fallback |
| BE-011 create invite fallback | **Fixed** — service-role fallback only on pgcrypto errors |
| FE-008 learning material wipe | **Fixed** — merge all languages before PATCH |
| FE-042 admin role promote | **Fixed** — stronger confirm for privileged roles |
| FE-011 missing Supabase env | **Fixed** — blocking config alert; no silent auth no-op |

### Batch 10 status (Auth enforcement + invite hygiene) — landed in repo

| ID | Status |
|----|--------|
| BE-024 invite preview PII | **Fixed** — public preview returns org/status only |
| BE-027 account suspended | **Fixed** — `ACCOUNT_SUSPENDED` 403 + frontend notice |
| BE-028 org suspension | **Fixed** — org admin APIs + accept blocked when suspended |
| FE-006 profile load timeout race | **Fixed** — settle flag so timeout cannot clobber success |
| FE-007 org load swallows errors | **Fixed** — surface org load failures |
| FE-012/016 invite token hygiene | **Fixed** — clear malformed/permanent-failure tokens |

### Severity key

| Level | Meaning |
|-------|---------|
| **P0** | Security break / hard lockout / data integrity compromise |
| **P1** | Major dead-end, broken core flow, or high-impact authz/leak |
| **P2** | Significant UX/logic flaw; users hit regularly |
| **P3** | Moderate inconvenience / inconsistency |
| **P4** | Polish, debt, tiny friction |

### Counts

| Severity | Count |
|----------|------:|
| P0 | 8 |
| P1 | 20 |
| P2 | 42 |
| P3 | 22 |
| P4 | 10 |

---

## Executive summary — fix these first

1. **Certification exam returns correct answers to the client** (`isCorrect` on start payload).
2. **RLS allows reading `scenario_options.is_correct`** and forging training/progress/certification rows via the Supabase client.
3. **Users can UPDATE their own `profiles.role` / `suspended_at`** (self-promote to admin).
4. **Session expiry shows “Retry workspace” with no sign-in path.**
5. **Expired invite link disables Sign in on the auth form.**
6. **Final opening-quiz save failure leaves answers advanced with no clean retry.**
7. **Certification timer hits 0 with no auto-submit / restart.**
8. **`/verify/*` has no Vercel SPA rewrite** — direct loads may 404.
9. **Org PATCH may fail** — no UPDATE RLS on `organizations`; `default_employee_language` not in migrations.
10. **Invite tokens returned in API responses** (including email-failure paths).

---

# Part A — Backend / database / security

## P0 — Critical

| ID | Category | Where | Issue | Impact | Fix |
|----|----------|-------|-------|--------|-----|
| **BE-001** | security | `certification.ts` `startCertificationAssessment` | Start response includes `questions[].options[].isCorrect` | Anyone can pass certification without answering | Strip `isCorrect` from start payload; score only on submit |
| **BE-002** | rls | `202609190015` `published_options_read` | Authenticated SELECT on `scenario_options` includes `is_correct` / `feedback` | Direct Supabase client bypasses training/cert integrity | View/RPC without answer columns; or column-level deny |
| **BE-003** | rls | `202609190007` `profiles_self_update` | UPDATE own profile with no column allowlist | Self-promote to `marics_admin`, clear suspension | Restrict columns via trigger / WITH CHECK |
| **BE-004** | rls | `certification_assessments_self` / answers | `FOR ALL` lets users write `passed`, `score`, `is_correct` | Forge certification pass | INSERT start-only; updates via security-definer RPC |
| **BE-005** | rls | `attempts_self` | Users insert `training_attempts` with arbitrary `is_correct` | Fake completion → certs / AI practice / gates | Score only via RPC |
| **BE-006** | rls | `training_progress_self` | Users upsert `completed_at` / counters | Mark all modules complete without training | Client read-only; maintain via triggers/RPC |

## P1 — High

| ID | Category | Where | Issue | Impact | Fix |
|----|----------|-------|-------|--------|-----|
| **BE-007** | security | `app.ts` invite route | On email failure, response still includes invitation `token` | Token leak in network/logs/UI | Never return raw token over HTTP |
| **BE-008** | security | `createInvitation` success | Successful create also returns raw `token` | Admin UI / proxies expose join secret | Email-only delivery of secret |
| **BE-009** | rls | `ai_practice_scenarios` | Options JSONB stores `is_correct`; owner can read full row | Cheat AI practice | Keep correctness server-side only |
| **BE-010** | logic | `acceptInvitation` service fallback | No `FOR UPDATE` / rowcount check like RPC | Concurrent accept races | Prefer RPC-only accept |
| **BE-011** | logic | `createInvitation` | Any RPC error triggers service-role fallback | Duplicates / masked failures | Fallback only on pgcrypto errors |
| **BE-012** | authz | memberships RLS | No DELETE policy for removing members | Remove-member API likely broken | Admin delete policy or RPC |
| **BE-013** | data | `updateOrganization` | Uses `default_employee_language` — **not in migrations** | Org settings PATCH fails | Add column or remove field |
| **BE-014** | authz | `organizations` RLS | Only SELECT + INSERT; **no UPDATE policy** | Org rename/settings fail under RLS | Org-admin UPDATE policy or RPC |
| **BE-015** | logic | `submitCertificationAssessment` | Reloads “first 30” questions; not bound to assessment | Start/submit mismatch; static memorization set | Persist question IDs at start |
| **BE-016** | logic | `startCertificationAssessment` | Unlimited concurrent open assessments | Overlapping timers / abuse | One active assessment per user |
| **BE-017** | ai | `scenario-why` | Quota reserved before Claude succeeds | Failed calls burn daily/monthly limits | Refund on failure or reserve after success |
| **BE-018** | rls | `risk_profiles_self` | Users can write own awareness scores | Inflated HRP / org aggregates | Write only via assessment RPC |

## P2 — Medium

| ID | Category | Where | Issue | Impact | Fix |
|----|----------|-------|-------|--------|-----|
| **BE-019** | logic | training completion | Completion = attempted, not correct | Wrong answers unlock modules/certs path | Require correct (or document clearly) |
| **BE-020** | consistency | progress counters | Read-modify-write without transaction | Race-skewed attempted/correct counts | Transactional RPC |
| **BE-021** | logic | `applyPracticeToRiskProfile` | AI answers overwrite category_scores | Distorts opening-quiz profile | Separate AI stats or merge carefully |
| **BE-022** | validation | `submitAssessment` | No single-baseline constraint | Retakes/spam reset profile freely | Idempotent baseline rules |
| **BE-023** | ai | `/api/ai/generate-scenario` | No completion gate (unlike AI practice) | Uneven product rules; cost burn | Align gates/quotas |
| **BE-024** | privacy | invite preview | Returns invitee email + org for bare token | PII if token leaks | Minimal preview until authenticated |
| **BE-025** | ops | CORS production | Missing origins → defaults to localhost | Misconfigured prod CORS | Fail startup if origins empty in prod |
| **BE-026** | security | CORS wildcards | Loose `ALLOWED_ORIGINS` patterns | Over-broad origin accept | Prefer exact origins |
| **BE-027** | ops | `requireUser` | Suspended = same as unauthenticated | No “account suspended” UX | Distinct `ACCOUNT_SUSPENDED` code |
| **BE-028** | authz | org suspension | `organizations.suspended_at` not enforced on org APIs | Suspended org still operates | Check in org middleware/RPCs |
| **BE-029** | ops | certificates award | Silent no-op without service role | Completions without certificates | Fail loudly / require env |
| **BE-030** | security | admin scenario update | Service role write without module↔scenario check | Admin UUID confusion / wrong target | Validate ownership |
| **BE-031** | email | `authEmail.ts` | Uses `magiclink` for signup verification | Wrong link semantics | Use correct Supabase link type |
| **BE-032** | rate-limit | demo-requests | Only global 100/min | Demo spam | Stricter per-IP + captcha |
| **BE-033** | rate-limit | scenario-why | Relies on DB reserve only | Burst cost / 503 if migration missing | Fastify route limit too |
| **BE-034** | privacy | org dashboard | Includes employee emails | Extra PII in admin UI/CSV | Mask or opt-in |
| **BE-035** | security | remove member | No last-admin / self-lockout guard | Org orphaned | Block removing last admin |

## P3 — Low

| ID | Category | Where | Issue | Impact | Fix |
|----|----------|-------|-------|--------|-----|
| **BE-036** | error-handling | certification submit | `CERTIFICATION_ALREADY_SUBMITTED` → 500 | Double-submit ugly error | Map to 409 |
| **BE-037** | validation | org routes | Some `organizationId` params not UUID-validated | Odd DB errors | Zod uuid everywhere |
| **BE-038** | security | invite 502 | May leak SMTP/Resend provider text | Minor info leak | Generic client message |
| **BE-039** | security | cert verify public | Unauthenticated UUID lookup, no rate limit | Enumeration / scraping | Rate limit + minimal fields |
| **BE-040** | consistency | admin resend | Double `requireMaricsAdmin` | Maintenance risk | Single authz layer |
| **BE-041** | validation | assessment schema | Options A–C only vs training A–D | Future 4-option quiz blocked | Align or document |
| **BE-042** | ops | `server.ts` | Binds `0.0.0.0` | Needs firewall/TLS discipline | Document / optional HOST |

---

# Part B — Frontend / UX / accessibility

## P0–P1 — Critical / high user pain

| ID | Category | Where | Issue | Impact | Fix |
|----|----------|-------|-------|--------|-----|
| **FE-001** | dead-end | session expiry screen | `authError` + no session → only “Retry workspace” | Locked out after 401 | Send to AuthScreen: “Session expired — sign in” |
| **FE-002** | logic | `submitAssessment` final Q | Advances answers before save succeeds | Failed save → stuck/confusing retry | Save first; only then advance |
| **FE-003** | dead-end | AuthScreen submit | `disabled={busy \|\| invitePreviewError}` blocks **sign-in** too | Expired invite = cannot sign in at all | Only block sign-up when invite invalid |
| **FE-004** | dead-end | CertificationAssessmentView | Timer 0 disables submit; no restart | Unwinnable exam | Auto-submit or “Start new attempt” |
| **FE-005** | dead-end | Vercel + `/verify/:id` | No SPA rewrite in `vercel.json` | Refresh/share verify URL 404s | Add rewrite to `index.html` |
| **FE-006** | logic | profile load timeout | 15s timeout races real response | False “could not load” | Cancel timeout on success |
| **FE-007** | error-handling | org load | `.catch(() => [])` swallows errors | Fake “no organization” | Surface error + retry |
| **FE-008** | logic | AdminScenarioEditor | Learning material PATCH sends one language only | May wipe AF/PT content | Merge full object before save |
| **FE-009** | crash | onboarding restore | `JSON.parse(sessionStorage)` uncaught | Corrupt storage → white screen | try/catch + clear key |
| **FE-010** | security | invite UI | Full invite token shown/copied | Shoulder-surfing of join secret | Mask; prefer email-only |

## P2 — Significant UX / logic

| ID | Category | Where | Issue | Impact | Fix |
|----|----------|-------|-------|--------|-----|
| **FE-011** | dead-end | missing Supabase env | Auth UI available but submit no-ops | Fake broken login | Blocking config screen |
| **FE-012** | ux | invalid invite | Stale token may stay in localStorage | Later silent wrong-token accept | Clear on invalid preview |
| **FE-013** | ux | PasswordRecoveryScreen | Success → workspace with no confirmation | Uncertainty | Success message then continue |
| **FE-014** | consistency | `validateInvitation` | API helper unused | Accept without pre-validate | Call validate before accept |
| **FE-015** | ux | password reset redirect | Lands on marketing origin | Unclear next step | Dedicated recovery hash/route |
| **FE-016** | logic | invite accept loop | Retries while token in storage | Repeated fail toasts | Clear on permanent errors |
| **FE-017** | logic | quiz sessionStorage | Writes before server save | Refresh desync | Persist after success |
| **FE-018** | ux | assessment save error | Toast only; unused `.assessment-submit-error` | Easy to miss failure | Inline error under CTA |
| **FE-019** | i18n | AssessmentView gate | Hardcoded English opening-quiz chrome | AF/PT see English | Wire i18n |
| **FE-020** | ux | retake quiz | May restore old sessionStorage answers | Contaminated retake | Clear storage on begin |
| **FE-021** | ux | migration errors | User sees SQL migration filenames | Confusing | User-safe copy |
| **FE-022** | a11y | quiz options | Missing `type="button"` / `aria-pressed` | A11y / form risk | Add attributes |
| **FE-023** | logic | ModuleTrainingView | `setState` during render for inspect | Extra renders / warnings | `useEffect` on slug |
| **FE-024** | logic | SmsInspector | Marks inspected on mount | Skips inspect-before-answer | Require real interaction |
| **FE-025** | logic | WhatsAppInspector | One path step unlocks answers | Weakens training design | Require end of path |
| **FE-026** | i18n | ScenarioInspectors | All hints English | Immersion broken in AF/PT | Localize |
| **FE-027** | ux | Next scenario | Wraps into AI slugs unpredictably | Jumps wrong | Separate manual/AI queues |
| **FE-028** | perf | AI why / generate | Long timeouts; no abort on navigate | Stale AI on wrong scenario | AbortController |
| **FE-029** | dead-end | `TrainingView` | Dead unused component | Drift | Delete |
| **FE-030** | a11y | inspector tabs | Incomplete tabpanel pattern | Screen reader gaps | Proper ARIA tabs |
| **FE-031** | consistency | CertificatesView | Hardcoded 80% / 30Q | Drift from API | Use API fields |
| **FE-032** | logic | cert gate | Detects gate via error string includes | Brittle | Structured error codes |
| **FE-033** | i18n | cert verify page | Module title always `.en` | Wrong language on print | Locale-aware title |
| **FE-034** | ux | certificates | Only “open new tab” | Extra step | In-app preview |
| **FE-035** | i18n | ProgressView | Titles `.en` only | Wrong language | `title[language]` |
| **FE-036** | dead-end | remove member | API exists, no UI | Cannot revoke employees | Add remove control |
| **FE-037** | dead-end | default language | API field, no settings UI | Cannot set org language | Add select |
| **FE-038** | ux | OrganizationReports | “Report ready” with little content | Confusing | Show metrics + downloads |
| **FE-039** | ux | org employee list | Sparse fields vs richer API | Missing activity insight | Show last activity / modules |
| **FE-040** | consistency | admin Settings/Audit | Both can show audit data | Confusing nav | Split destinations |
| **FE-041** | dead-end | RoleSection / ai-content | Placeholder “No records” | Dead feature surface | Hide until real |
| **FE-042** | security | admin role select | Easy mis-promote | Accidental privilege change | Confirm modal |
| **FE-043** | logic | overview routing | Org vs individual landing edge cases | Wrong dashboard | Central resolver |
| **FE-044** | ux | marics_admin | Learner-oriented gate copy possible | Confusing for platform admin | Admin-specific copy |
| **FE-045** | consistency | org admin canTrain | Full learner nav for admins | Product ambiguity | Document or split nav |
| **FE-046** | mobile | styles ≤620px | Sign-out / language hidden | Cannot sign out on phone | Keep controls visible |
| **FE-047** | mobile | styles ≤850px | Profile name `font-size: 0` | Identity lost | Show abbreviated name |
| **FE-048** | a11y | `scroll-behavior: smooth` | Not disabled for reduced-motion | Vestibular issues | Respect prefers-reduced-motion |
| **FE-049** | a11y | progress bars | Inconsistent progressbar semantics | AT gaps | Consistent roles/labels |

## P3–P4 — Consistency / polish

| ID | Category | Where | Issue | Impact | Fix |
|----|----------|-------|-------|--------|-----|
| **FE-050** | consistency | CSS | Duplicate `.empty-state` / `.module-card.blue` | Unpredictable styles | Deduplicate |
| **FE-051** | polish | CSS | `.notification` unused | Dead CSS | Remove or implement |
| **FE-052** | polish | CSS | `.error-screen` used, not defined | Unstyled errors | Add styles |
| **FE-053** | i18n | auth JSON | Large unused `t.auth` / assessment Qs | False coverage | Use or prune |
| **FE-054** | i18n | document lang | Only PublicSite sets `html.lang` | Logged-in AF/PT wrong lang | Set from profile |
| **FE-055** | consistency | CTA copy | “assessment” vs “opening quiz” | Funnel mismatch | Align naming |
| **FE-056** | polish | saveError toast | No dismiss button | Sticky corner error | Add dismiss |
| **FE-057** | i18n | HelpCentre | English only | Non-EN help useless | Localize |
| **FE-058** | a11y | buttons | Many missing `type="button"` | Form double-submit risk | Add types |
| **FE-059** | i18n | EmployeeDashboard | Recommendation title `.en` | Wrong language | Localize |
| **FE-060** | perf | main.tsx | ~1.4k lines; little code-split | Slow TTI | Lazy-load workspace views |

---

# Part C — Cross-cutting product / process issues

These are not single-line bugs but real reasons the product still feels “buggy.”

| ID | Severity | Issue |
|----|----------|-------|
| **XP-001** | P1 | **No frontend automated tests** — regressions land silently |
| **XP-002** | P1 | **No Playwright/E2E** — invite, quiz, cert, AI practice unproven |
| **XP-003** | P1 | **`bug-ledger.md` stale** — claims invite email unfinished, AI deferred, etc. |
| **XP-004** | P1 | **README / project-status lag** — migrations & AI practice outdated until COMPLETE guide |
| **XP-005** | P2 | **Monolithic SPA** — every bug clusters in `main.tsx` |
| **XP-006** | P2 | **Clean Supabase migration-from-zero** not CI-proven |
| **XP-007** | P2 | **Dev/seed content** may ship (SQL-injection style scenarios) |
| **XP-008** | P2 | **Terminology drift** — assessment / opening quiz / Human Risk Profile / standing |
| **XP-009** | P3 | **Legacy multi-MB images** still in `public/assets` beside WebP |
| **XP-010** | P3 | **Docs split across 8 files** — easy to follow stale guidance |

---

# Part D — User-journey pain map

| Journey | Biggest blockers |
|---------|------------------|
| Sign in | Expired invite disables form (FE-003); missing env (FE-011); session expiry (FE-001) |
| Opening quiz | Final save race (FE-002); English-only chrome (FE-019); retake restore (FE-020) |
| Training | Inspect skips (FE-024/025); next wraps oddly (FE-027); AI stale (FE-028) |
| AI practice | Answer leak via RLS/JSONB (BE-009); why quota burn (BE-017) |
| Certificates | Correct answers in start payload (BE-001); timer dead-end (FE-004); stringly errors (FE-032) |
| Org admin | Org UPDATE RLS missing (BE-014); no remove-member UI (FE-036); token shown (FE-010) |
| Invite employee | Token in API (BE-007/008); email mismatch friction; preview PII (BE-024) |
| Mobile | Sign-out gone (FE-046); name hidden (FE-047) |
| AF/PT | Inspectors, help, progress, auth chrome largely English |
| Admin platform | Learning material wipe risk (FE-008); role select (FE-042); placeholder views (FE-041) |

---

# Part E — Suggested fix batches (PR-sized)

### Batch 1 — Integrity (stop cheating / self-admin) — P0
- Strip certification `isCorrect` from API response  
- Harden RLS: profiles columns, attempts, progress, certification, options  
- Do not return invite tokens in HTTP bodies  

### Batch 2 — Auth & onboarding dead-ends — P0/P1
- Session expiry → sign-in screen  
- Invite error must not disable sign-in  
- Final quiz save retry correctness  
- Clear bad sessionStorage safely  

### Batch 3 — Org admin actually works — P1
- Organizations UPDATE RLS + schema for language field  
- Member remove policy + UI  
- Hide/mask invite tokens  

### Batch 4 — Certification UX — P1
- Timer expiry handling  
- Structured error codes for cert gate  
- Bind pass % / time from API  

### Batch 5 — Training honesty — P2
- SMS/WhatsApp inspect gates  
- Abort AI requests on navigate  
- Scenario next navigation  

### Batch 6 — i18n / mobile / a11y — P2–P4
- Localize inspectors + help + progress titles  
- Mobile sign-out  
- reduced-motion scroll  
- button types / aria  

### Batch 7 — Ops / hosting
- Vercel SPA rewrites for `/verify/*`  
- Prod CORS fail-fast  
- Certificate verify rate limit  

---

# Part F — What was *not* fully verified (honest gaps)

- Live browser pass across roles/devices  
- Production network timings / Lighthouse  
- Real Gmail/Resend deliverability rates  
- Whether every migration applies cleanly on a brand-new Supabase project  
- Whether Vercel already has dashboard-level rewrites compensating for missing `vercel.json` rewrite  

---

*Generated for MARICS Security. Prefer fixing Batch 1–3 before more feature polish. Cross-link: [`COMPLETE-SYSTEM-GUIDE.md`](./COMPLETE-SYSTEM-GUIDE.md), [`bug-ledger.md`](./bug-ledger.md).*
