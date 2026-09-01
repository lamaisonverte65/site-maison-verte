# V4.7-B External Occupancy Conflicts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect, persist, alert, and display Booking/Airbnb overlaps with local blockers while leaving resolution manual.

**Architecture:** A service-role-only PostgreSQL reconciliation RPC derives conflicts from the persisted occupation registry and local blocker tables. The existing scheduled job runs reconciliation only for successfully synchronized sources, claims alerts atomically, sends one owner email per occurrence, and exposes open conflicts through an owner-only endpoint to the existing calendar dialog.

**Tech Stack:** PostgreSQL/Supabase migrations and RPCs, Netlify scheduled functions, Node.js ES modules and test runner, React, Vite.

**Spec:** `docs/superpowers/specs/2026-09-01-v4-7-b-external-conflicts-design.md`

## Global Constraints

- External periods use `[start_date, end_date)`.
- Every one-night Booking or Airbnb row is a technical block and never creates a conflict or alert.
- Local booking blockers use the V4.7-A status and source allowlists exactly.
- `calendar_blocks` participates as a local blocker.
- A failed feed never resolves conflicts for that source.
- No automatic cancellation, refund, priority decision, or booking mutation.
- No V4.7-A, Stripe V4.5, analytics V4.6, RES-02, pricing, or general iCal refactor.
- No commit, push, deployment, or production migration.

---

### Task 1: Specify the durable SQL contract

**Files:**
- Create: `tests/v47b-migration.test.js`
- Create: `supabase/migrations/202609010002_v47b_external_occupancy_conflicts.sql`

**Interfaces:**
- Produces: `external_occupancy_conflicts`, `reconcile_external_occupancy_conflicts(text,timestamptz)`, and `claim_external_occupancy_conflict_alerts(integer,timestamptz,integer)`.

- [ ] Write migration-text tests requiring the unique identity, exact status/source predicates, half-open overlap, one-night exclusion for both sources, lifecycle fields, service-role-only grants, RLS, no delete grant, and no reference to `external_calendar_actions`.
- [ ] Run `node --test tests/v47b-migration.test.js` and verify the missing migration fails for the expected reason.
- [ ] Add the minimal additive migration with table constraints, indexes, reconciliation RPC, atomic claim RPC, grants, comments, and rollback comments.
- [ ] Re-run the migration tests and keep them green.

### Task 2: Specify conflict orchestration and safe email content

**Files:**
- Create: `tests/external-occupancy-conflicts.test.js`
- Create: `netlify/functions/_lib/external-occupancy-conflicts.js`

**Interfaces:**
- Produces: `reconcileSuccessfulExternalSources(repository, sources, detectedAt)`, `processExternalConflictAlerts(repository, sendEmail, now)`, and `buildExternalConflictAlertEmail(conflict, ownerEmail)`.
- Consumes: repository methods `reconcileSource`, `claimAlerts`, `markSent`, and `release`.

- [ ] Write failing tests for successful-source-only reconciliation, deduplicated source input, no source resolution on feed failure, one email per claimed row, no resend after no claim, release on delivery failure, and absence of guest/contact/message/financial data in email output.
- [ ] Run the focused test and verify failure because the module is absent.
- [ ] Implement the smallest dependency-injected orchestration and escaped email builder.
- [ ] Re-run the focused test and refactor only while green.

### Task 3: Integrate reconciliation and delivery into the scheduled job

**Files:**
- Modify: `netlify/functions/check-external-calendar-alerts.js`
- Modify: `tests/external-calendar-alerts.test.js`

**Interfaces:**
- Consumes the Task 2 orchestration and Task 1 RPCs.
- Preserves `persistExternalOccupancies` and the existing missing-action alert path.

- [ ] Add failing structural and behavior assertions proving import precedes reconciliation, only `successfulSources` are reconciled, conflict processing does not suppress persistence, and the five-minute scheduled boundary remains unchanged.
- [ ] Run the focused tests and verify the expected missing-integration failures.
- [ ] Add repository adapters for reconcile, atomic claim, sent, and retry; call them after persistence; send Resend conflict emails with the validated owner recipient.
- [ ] Re-run `tests/external-calendar-alerts.test.js` and `tests/external-occupancy-conflicts.test.js`.

### Task 4: Add an owner-only open-conflict endpoint

**Files:**
- Create: `netlify/functions/get-external-occupancy-conflicts.js`
- Create: `tests/external-conflicts-endpoint.test.js`

**Interfaces:**
- Produces: `GET /.netlify/functions/get-external-occupancy-conflicts` returning explicit non-PII open-conflict fields.
- Consumes: `authorizeAdminRequest(event, supabase, { ownerOnly: true })`.

- [ ] Write failing tests requiring GET-only behavior, owner-only authorization, explicit column selection, `status = open`, and exclusion of guest/contact/message/financial fields.
- [ ] Run the focused test and verify failure because the endpoint is absent.
- [ ] Implement the minimal endpoint through the service-role client and existing authorization helper.
- [ ] Re-run the endpoint tests and Netlify syntax check for the new function.

### Task 5: Reuse the admin conflict dialog without exposing housekeeping data

**Files:**
- Create: `src/components/admin/calendar/externalConflictPresentation.js`
- Modify: `src/components/calendar/CalendarConflictDialog.jsx`
- Modify: `src/components/CalendarAdmin.jsx`
- Create: `tests/external-conflicts-ui.test.js`

**Interfaces:**
- Produces: `shouldLoadExternalConflicts(mode)`, `normalizeOpenExternalConflicts(rows)`, and a dialog accepting `conflicts`, `error`, `onClose`, and `onOpenLocal`.

- [ ] Write failing tests for zero/open/resolved projection, minimal displayed data, owner-mode loading, housekeeping exclusion, visible load failure, and booking-request navigation.
- [ ] Run the focused test and verify failure because the presentation module and wiring are absent.
- [ ] Implement the pure projection helper, owner-only fetch in `CalendarAdmin`, compact dialog rendering, and local-booking navigation.
- [ ] Re-run the UI tests and existing housekeeping UI tests.

### Task 6: Validate on real disposable PostgreSQL

**Files:**
- No repository file changes.

**Interfaces:**
- Exercises the Task 1 migration against PostgreSQL 17 with prerequisite tables and roles.

- [ ] Start a uniquely named disposable PostgreSQL container from the existing local image and verify the exact target before cleanup.
- [ ] Apply prerequisite project migrations/schema and the V4.7-B migration.
- [ ] Verify real Booking/Airbnb overlaps, adjacency, both one-night exclusions, nonblocking statuses, local source allowlist, and calendar blocks.
- [ ] Verify persistence, resolution only for a reconciled source, reappearance occurrence increment, unique identity, and two concurrent reconciliations without duplication.
- [ ] Verify concurrent alert claims are disjoint, expired claims are recoverable, and `anon`/`authenticated` cannot execute sensitive RPCs or read the table while `service_role` can.
- [ ] Stop and remove only the verified disposable container.

### Task 7: Run final non-regression and scope verification

**Files:**
- No functional changes unless a failing test identifies a V4.7-B defect; any defect starts a new red-green cycle.

- [ ] Run all V4.7-B focused tests.
- [ ] Run the V4.7-A focused tests.
- [ ] Run `npm test` and record totals.
- [ ] Run `npm run build` and record bundle warnings separately from failures.
- [ ] Run `node --check` over every Netlify JavaScript file.
- [ ] Run `git diff --check`, inspect `git status`, and scan changed files for high-confidence secrets.
- [ ] Confirm protected Stripe V4.5, analytics V4.6, and V4.7-A invariant files are unchanged except the scheduled/calendar files explicitly in V4.7-B scope.
- [ ] Confirm no commit, push, deployment, production access, cancellation, refund, or direct-booking rule change occurred.
