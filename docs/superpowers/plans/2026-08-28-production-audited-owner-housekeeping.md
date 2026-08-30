# Production-Audited Owner and Housekeeping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the locally prepared owner/housekeeping migrations and server contracts against the audited production schema without any remote write or commit.

**Architecture:** Phase A establishes a null-safe transitional owner model and restrictive database authorization boundary; Phase B finalizes Auth-ID-only profiles after controlled repairs. A dedicated persistent `external_occupancies` registry is synchronized from upstream iCal feeds, while append-only housekeeping notes target stable booking or registry UUIDs through authenticated server endpoints.

**Tech Stack:** PostgreSQL/Supabase migrations, Netlify Functions, Supabase JS, React, Node test runner, Vite.

**Spec:** `docs/superpowers/specs/2026-08-28-production-audited-owner-housekeeping-design.md`

## Global Constraints

- Work only in the local workspace.
- Do not contact Supabase, Booking, Airbnb, Netlify, Stripe, Resend, or any external service.
- Do not apply a migration, deploy, commit, or push.
- Preserve all historical business rows and columns; no `DROP`, `TRUNCATE`, or business-data `DELETE`.
- Use fake credentials only in tests.
- `external_occupancies` means the canonical local persistent registry; iCal feeds remain upstream sources.
- Housekeeping is read-only except for inserting a separate append-only housekeeping note.

---

### Task 1: Production-compatible Phase A and Phase B

**Files:**
- Create: `tests/owner-housekeeping-migrations.test.js`
- Modify: `supabase/migrations/202608280001_owner_housekeeping_phase_a.sql`
- Modify: `supabase/migrations/202608280002_owner_housekeeping_phase_b.sql`

**Interfaces:**
- Consumes: audited production roles, constraints, grants, policies, and table names.
- Produces: additive Phase A SQL and guarded strict Phase B SQL.

- [ ] **Step 1: Write migration-text tests that require null-safe owner checks, explicit active-null-role blocking, `external_calendar_actions`/`refunds` RLS coverage, Phase A public compatibility, Phase B anonymous booking-read denial, and absence of speculative columns or permission rewrites.**
- [ ] **Step 2: Run `node --test tests/owner-housekeeping-migrations.test.js` and confirm failures identify the current SQL differences.**
- [ ] **Step 3: Minimize Phase A, add the missing guarded RLS targets, preserve legacy public flows, and express owner constraints with `IS DISTINCT FROM`.**
- [ ] **Step 4: Strengthen Phase B preflight with `role IS NULL OR role NOT IN ('owner', 'housekeeping')`, create the final role constraint, and revoke anonymous booking reads only after compatible code is deployed.**
- [ ] **Step 5: Run the focused migration tests until they pass.**

### Task 2: Persistent external-occupation lifecycle

**Files:**
- Modify: `tests/external-calendar-alerts.test.js`
- Modify: `netlify/functions/_lib/external-calendar-alerts.js`
- Modify: `netlify/functions/check-external-calendar-alerts.js`

**Interfaces:**
- Consumes: parsed rows `{source, external_uid, start_date, end_date}` and one ISO synchronization timestamp.
- Produces: `persistExternalOccupancies(repository, occupations, seenAt)` grouped by source; repository methods `upsertOccupancies(rows)` and `retireUnseenOccupancies(source, seenAt)`.

- [ ] **Step 1: Add failing tests proving valid rows become `is_current: true`, duplicate source/UID rows collapse, and retirement is requested only for sources represented by a successful fetch.**
- [ ] **Step 2: Run `node --test tests/external-calendar-alerts.test.js` and verify the new expectations fail.**
- [ ] **Step 3: Add source-aware synchronization output and invoke retirement only after the source upsert succeeds.**
- [ ] **Step 4: Implement the Supabase repository update that marks only older rows of the successful source as non-current.**
- [ ] **Step 5: Run the focused tests until green.**

### Task 3: Stable-UUID housekeeping schema

**Files:**
- Modify: `tests/housekeeping-migration.test.js`
- Modify: `supabase/migrations/202608280003_housekeeping_notes.sql`

**Interfaces:**
- Produces: `external_occupancies(id uuid, source, external_uid, dates, is_current, timestamps)` and `housekeeping_notes(booking_request_id | external_occupation_id, author_admin_user_id, note, created_at)`.

- [ ] **Step 1: Replace the composite-FK assertions with failing assertions for `external_occupation_id uuid`, a simple FK to `external_occupancies(id)`, `is_current`, exactly-one-target validation, and append-only grants.**
- [ ] **Step 2: Run `node --test tests/housekeeping-migration.test.js` and confirm failure against the current migration.**
- [ ] **Step 3: Rewrite migration `003` without backfilling action/client rows and without destructive SQL.**
- [ ] **Step 4: Run the focused migration test until green.**

### Task 4: UUID-targeted note creation and listing

**Files:**
- Modify: `tests/housekeeping-notes.test.js`
- Modify: `netlify/functions/_lib/housekeeping-notes.js`
- Modify: `netlify/functions/housekeeping-notes.js`

**Interfaces:**
- Consumes: browser reservation IDs and authenticated profile IDs.
- Produces: note insert rows containing exactly one of `booking_request_id` or `external_occupation_id`.

- [ ] **Step 1: Add failing tests requiring the external lookup to return a registry UUID and the insert to contain only `external_occupation_id`.**
- [ ] **Step 2: Run `node --test tests/housekeeping-notes.test.js` and verify the composite-key insert expectation fails.**
- [ ] **Step 3: Return the registry row from `findExternalTarget`, bind its UUID, and query notes by stable target ID.**
- [ ] **Step 4: Keep arbitrary external IDs, browser-supplied authors, update, and delete operations rejected.**
- [ ] **Step 5: Run the focused note tests until green.**

### Task 5: Minimal production-compatible housekeeping projection

**Files:**
- Modify: `tests/housekeeping-contract.test.js`
- Modify: `netlify/functions/housekeeping.js`
- Modify: `netlify/functions/_lib/housekeeping-contract.js`

**Interfaces:**
- Consumes: current registry rows, existing external enrichment fields, active applied external actions, and notes keyed by stable UUID.
- Produces: the existing allowlisted housekeeping JSON contract with unavailable fields as `null`.

- [ ] **Step 1: Add failing source tests proving absent production columns and `owner_message` are not selected, external rows are current-only, notes map by registry UUID, and transformed events are suppressed.**
- [ ] **Step 2: Run `node --test tests/housekeeping-contract.test.js` and verify the query/shape expectations fail.**
- [ ] **Step 3: Narrow direct and external selects to audited columns and select only the action fields needed for suppression.**
- [ ] **Step 4: Filter active applied actions with created booking/block IDs and preserve `null` for unavailable qualified fields.**
- [ ] **Step 5: Run the focused contract tests until green.**

### Task 6: Clarify dormant external enrichment and audit contract

**Files:**
- Modify: `netlify/functions/update-external-reservation-client.js`
- Modify: `docs/operations/supabase-production-readonly-migration-audit.sql`
- Modify: `docs/operations/admin-users-owner-repair.md`
- Modify: `docs/superpowers/specs/2026-08-28-housekeeping-readonly-notes-design.md`

**Interfaces:**
- Produces: existing-schema enrichment writes, corrected audit expectations, and a production order aligned with the audited design.

- [ ] **Step 1: Add or update source-level tests so the enrichment writer does not depend on absent structured columns and still stores owner housekeeping notes in the existing column.**
- [ ] **Step 2: Run the relevant external-customer and contract tests and observe the intended failure.**
- [ ] **Step 3: Simplify the enrichment persistence to audited columns and document that initial owner enrichment UI remains outside this correction.**
- [ ] **Step 4: Remove `owner_message`, `departure_time`, `practical_information`, and unselected external fields from audit block 34 expectations while retaining the explicit limitations.**
- [ ] **Step 5: Update the runbook sequence without embedding any production email or UUID.**
- [ ] **Step 6: Run the focused tests until green.**

### Task 7: Full local verification and final audit report

**Files:**
- Review: all modified and untracked files in scope.

**Interfaces:**
- Produces: fresh evidence for tests, syntax, build, whitespace, and residual-risk reporting.

- [ ] **Step 1: Run `npm test`.**
- [ ] **Step 2: Run `node --check` for every JavaScript file under `netlify/functions`.**
- [ ] **Step 3: Run an isolated `npm run build` with no remote call.**
- [ ] **Step 4: Run `git diff --check`.**
- [ ] **Step 5: Inspect the complete diff and confirm no secret, production identifier, destructive SQL, migration application, or unrelated overwrite was introduced.**
- [ ] **Step 6: Produce the requested A–J final report, including exact production order, inter-step checks, rollback boundaries, migration verdicts, and residual risks.**
