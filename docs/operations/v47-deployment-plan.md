# V4.7-A + V4.7-B Production Deployment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this runbook step by step. Every production mutation requires a fresh explicit authorization. This document is preparation only.

**Goal:** Prepare the combined deployment of V4.7, its validated security follow-up, and the persistent external-calendar display without exposing new application code to missing PostgreSQL objects.

**Architecture:** Both migrations are additive and backward-compatible with the currently deployed application. After local validation and creation of the separate operational snapshot, PostgreSQL is upgraded first, V4.7-A then V4.7-B, and only after both database checks pass are the three local Git commits pushed for Netlify deployment.

**Tech Stack:** Supabase PostgreSQL, `pg_dump`, Netlify Functions, Vite, Git, PowerShell.

**Pre-check:** `docs/operations/v47-production-readonly-precheck.sql`

## Fixed versions

- V4.7-A: `706332d8c0b3550c486836574e6b8d4bbef5a670` — `V4.7-A - prevent concurrent direct booking overlaps`
- V4.7-B: `81d17e1fabf355c095227af69f5bda93b37c1ba3` — `V4.7-B - detect and alert external booking conflicts`
- V4.7-A corrective commit: `280e999c8b2c5129b1fc4a96e6a8e44f1e211e23` — `V4.7-A fix - ignore one-night Airbnb technical blocks`
- V4.7 source correction: `02d122b` — `V4.7 fix - treat website as a local booking source`
- Supabase client update: `cd2d444` — `Update Supabase client to 2.113.0`
- Security follow-up: `687dbbe120274493e0f6ae40663e2e94dd7ff3e5` — `Secure housekeeping passwords and revoke anonymous booking inserts`
- Current committed preparation HEAD: `687dbbe120274493e0f6ae40663e2e94dd7ff3e5`
- Expected deployment HEAD: **to be recorded after the persistent-calendar change is reviewed and committed**.

The persistent-calendar change is intentionally uncommitted during preparation. Before snapshot or deployment, obtain explicit approval for its commit and replace the deployment-HEAD placeholder above. The two operational documents remain outside the application commit unless separately authorized.

## External calendar display architecture

- `sync-external-calendars` remains the only live iCal reader and persists the last reliable state in `external_occupancies` on its scheduled run.
- `calendar.js` reads current persisted occupations; it no longer downloads Booking/Airbnb feeds during each public or admin page load.
- A failure to read the persistent registry returns an error instead of silently presenting an empty external calendar.
- The owner calendar receives a per-provider synchronization status derived from `external_occupancy_conflict_runs.last_reconciled_at`; no successful run within 15 minutes is shown as an explicit warning.
- Known persisted unavailability remains displayed during a stale-source warning. One-night Booking and Airbnb technical blocks remain excluded.
- Before production GO, the owner must manually verify that both Netlify iCal URL variables still contain the current exported Booking/Airbnb links. The URLs and their values must never be copied into this runbook, Git, logs, or reports.
- A changed-but-valid platform URL is an operational configuration correction, not a code change. After correction, one successful scheduled synchronization must be observed before GO.

## Security follow-up migration

File: `supabase/migrations/202609030001_revoke_anon_booking_insert.sql`

- revokes only `INSERT` on `public.booking_requests` from `anon`;
- drops only the obsolete `Allow public insert booking requests` policy if present;
- preserves the server-side public path through `send-booking-request` and the service-role-only atomic RPC;
- does not alter booking data, Stripe, analytics, or other table privileges.

## Migration audit

### V4.7-A

File: `supabase/migrations/202609010001_v47a_atomic_direct_bookings.sql`

Creates or changes:

- adds the partial GiST exclusion constraint `booking_requests_no_overlapping_local_blockers` on `daterange(start_date, end_date, '[)')`;
- the predicate is limited to statuses `pending`, `accepted`, `deposit_paid`, `paid`, `fully_paid`, `confirmed` and local sources `NULL`, `website`, `direct`, `admin_client`, `admin_personal`;
- creates `public.create_public_booking_request_atomic(jsonb,text,timestamptz)` as `SECURITY DEFINER` with an empty `search_path`;
- revokes RPC execution from `PUBLIC`, `anon`, and `authenticated`;
- grants RPC execution to `service_role` only;
- excludes current one-night technical rows from both `booking` and `airbnb` when checking known external occupations;
- retains the observed `booking_requests.source DEFAULT 'website'` for public INSERTs; `website` is explicitly classified as local, alongside the compatible historical aliases;
- does not create a table, policy, extension, index by name, or data row.

Prerequisites:

- `booking_requests`, `calendar_blocks`, `external_occupancies`, and `public_rate_limits` with the columns referenced by the migration;
- `booking_requests.id` and the RPC return identifier must be `uuid`;
- `public.claim_public_rate_limit(text,text,integer,integer,timestamptz)` must already exist;
- built-in PostgreSQL `daterange`, the GiST access method, and `gen_random_uuid` availability for downstream V4.7-B;
- no `btree_gist` extension is used or required because the exclusion key contains only the range expression.

Possible failures:

- any unclassified `booking_requests.source` outside the migration's closed list;
- invalid local blocking dates, including NULL or `end_date <= start_date`;
- an existing overlap between two local blocking reservations;
- an existing incompatible constraint or function with the same name/signature;
- missing prerequisite table, column, type, function, range operator, or GiST support;
- an `ALTER TABLE` lock timeout caused by concurrent production activity.

The migration never corrects, deletes, shifts, or reclassifies historical reservations. It aborts before adding the constraint when its explicit preconditions fail.

Provider-neutral one-night rule verified before production:

- `booking` and `airbnb` rows where `end_date = start_date + 1` are technical blocks rather than stays;
- the corrected V4.7-A RPC does not treat either provider's one-night row as a direct-booking conflict;
- V4.7-B excludes the same rows from external conflict detection;
- multi-night current rows from both providers remain normal external blockers/conflict candidates.

### V4.7-B

File: `supabase/migrations/202609010002_v47b_external_occupancy_conflicts.sql`

Creates:

- `public.external_occupancy_conflicts` with foreign key to `external_occupancies(id)`, period/status checks, stable unique identity `(external_occupancy_id, local_kind, local_id)`, lifecycle snapshots, and alert claim state;
- `public.external_occupancy_conflict_runs`, keyed by source, to prevent an older reconciliation generation replacing newer conflict state;
- partial indexes `external_occupancy_conflicts_open_source_idx` and `external_occupancy_conflicts_claim_idx`;
- RPCs:
  - `reconcile_external_occupancy_conflicts(text,timestamptz)`;
  - `claim_external_occupancy_conflict_alerts(integer,timestamptz,integer)`;
  - `mark_external_occupancy_conflict_alert_sent(uuid,integer,timestamptz)`;
  - `release_external_occupancy_conflict_alert(uuid,integer,timestamptz)`.

Security:

- RLS is enabled on both new tables;
- all table rights are revoked from `PUBLIC`, `anon`, and `authenticated`;
- `service_role` receives only `SELECT`, `INSERT`, and `UPDATE` on both tables;
- no service-role `DELETE` or `TRUNCATE` grant is added;
- all four RPCs are revoked from `PUBLIC`, `anon`, and `authenticated`, then granted to `service_role` only;
- owner UI reads go through the authenticated owner-only Netlify endpoint, not direct table grants.

Possible failures:

- an existing incompatible table, index, constraint, or function of the same name;
- `external_occupancies.id`, `booking_requests.id`, or `calendar_blocks.id` not being compatible with the migration's `uuid` columns and UNION;
- missing prerequisite tables/columns;
- unavailable `gen_random_uuid`;
- lock or statement timeout during object creation.

V4.7-B does not rewrite existing occupations or reservations. Its conflict tables begin empty; real conflicts are populated later by the scheduled reconciliation after a successful source synchronization.

## Dependency and mandatory order

The safe order is the sequence below: local validation, separate operational snapshot, manual snapshot-only environment restoration, production backup and read-only pre-check, the two V4.7 database migrations plus the targeted anonymous-INSERT revocation with separate gates, then the authorized Git push and Netlify verification.

V4.7-B repeats the exact V4.7-A local status/source predicate but does not call the V4.7-A RPC. Applying A first nevertheless establishes the local-overlap invariant before external conflicts can be derived. Applying both migrations before the push is essential: the old deployed code does not require the new objects, while the new Netlify code immediately calls the new RPCs and endpoint tables.

During the short interval after V4.7-A and before the new Netlify deployment, the database constraint already protects concurrent local writes. A concurrent collision through old application code may surface as a generic failure instead of `DATE_CONFLICT`; schedule a low-traffic maintenance window and minimize this interval.

## `.env` and operational snapshot rule

- The `.env` inside `travail` is intentionally fictitious and remains so. It is not a deployment anomaly.
- Never request, search for, copy, or inspect the real production `.env` during Codex work.
- Never replace or modify the fictitious `.env` in `travail` merely for deployment.
- After final local validation, create a complete copy of `travail` in a separate `V4.7` directory and verify that its tracked content corresponds exactly to deployment HEAD `280e999c8b2c5129b1fc4a96e6a8e44f1e211e23`.
- Manually replace the fictitious `.env` only inside that separate `V4.7` snapshot, using the real file stored outside `travail`.
- Never add the real `.env` to Git and never share the complete `V4.7` ZIP with ChatGPT or Codex.
- Continue using `travail`, with its fictitious `.env`, for later development and exchanges.
- The `V4.7` directory is an operational/restorable local snapshot. It does not replace the GitHub push that triggers Netlify.

No snapshot or real-environment restoration is performed during preparation.

## PHASE 1 — Final local validation

Reconfirm the final commit list and deployment HEAD, clean tracked state, tests, build, migration order, provider-neutral one-night behavior, persisted-calendar behavior, and absence of real secrets in tracked content. The two untracked pre-deployment documents are operational inputs and are not part of deployment HEAD unless separately authorized.

## PHASE 2 — Create the separate local V4.7 snapshot

Only after explicit authorization, copy the complete `travail` directory into the distinct operational `V4.7` directory. Do not mutate `travail`. Verify the snapshot's tracked files against HEAD and confirm that no transient build output or unrelated file changes its operational meaning.

## PHASE 3 — Manually restore the real `.env` in the snapshot only

The owner manually replaces the fictitious `.env` inside `V4.7` with the real `.env` stored outside `travail`. Codex does not access either the source secret file or the resulting real snapshot. Verify manually that the real `.env` remains untracked and that the `V4.7` snapshot will not be shared.

## PHASE 4 — Supabase production backup

Do not run without explicit production authorization. Use a secure process environment variable for the database URL; never write it to a script, report, shell history, or repository file.

Target directory convention:

```text
C:\Users\pc\Desktop\Site La MaisonVerte\Supabase\YYYY-MM-DD_avant_V4.7
```

Expected files:

- `schema.sql`
- `data.sql`
- `roles.sql`
- `SHA256SUMS.txt`

PowerShell procedure to execute only after authorization, with `SUPABASE_DB_URL` supplied securely in the process environment:

```powershell
$backupDirectory = 'C:\Users\pc\Desktop\Site La MaisonVerte\Supabase\YYYY-MM-DD_avant_V4.7'
New-Item -ItemType Directory -Path $backupDirectory
pg_dump --dbname="$env:SUPABASE_DB_URL" --schema-only --format=plain --file="$backupDirectory\schema.sql"
pg_dump --dbname="$env:SUPABASE_DB_URL" --data-only --format=plain --file="$backupDirectory\data.sql"
pg_dumpall --database="$env:SUPABASE_DB_URL" --roles-only --file="$backupDirectory\roles.sql"
$hashFiles = @('schema.sql', 'data.sql', 'roles.sql')
$hashLines = foreach ($name in $hashFiles) {
  $hash = Get-FileHash -Algorithm SHA256 -LiteralPath "$backupDirectory\$name"
  "$($hash.Hash.ToLowerInvariant())  $name"
}
Set-Content -LiteralPath "$backupDirectory\SHA256SUMS.txt" -Value $hashLines -Encoding ascii
```

Mandatory validation before continuing:

- all four expected files exist;
- `schema.sql`, `data.sql`, and `roles.sql` are non-empty;
- recomputed SHA-256 values match `SHA256SUMS.txt`;
- the target directory is outside the Git repository;
- no `Connection String.txt`, password, token, `.env`, or secret is present in the directory or report.

## PHASE 5 — Read-only production pre-check

Run every statement in `docs/operations/v47-production-readonly-precheck.sql` against production using a read-only operator/session where available. Save the result sets outside the repository without credentials or PII.

Do not edit, skip, or replace result sets after seeing an anomaly.

## PHASE 6 — GO / STOP decision

Current preparation decision: the historical one-night Airbnb blocker is cleared locally. The final deployment HEAD remains to be recorded after review of the uncommitted persistent-calendar change. Production remains gated by the GO conditions below and by explicit authorization; this is not authorization to perform any production action.

GO requires all of the following:

- backup validation complete;
- exact Git HEAD reconfirmed, with no tracked or indexed change and only the two expected pre-deployment documents untracked;
- prerequisite tables, columns, UUID types, GiST, `daterange`, `gen_random_uuid`, and `claim_public_rate_limit` present;
- zero unclassified booking source;
- zero invalid local blocking period;
- zero historical overlap between local blocking booking requests;
- no unexplained pre-existing V4.7 table, index, constraint, or RPC name;
- every invalid/null/duplicate external or calendar-block row reviewed and classified;
- all simulated immediate V4.7-B conflicts reviewed by the owner as expected operational conflicts, never silently discarded;
- the V4.7-A RPC applies the confirmed one-night technical-block exclusion consistently to both Booking and Airbnb, with PostgreSQL and application tests proving it;
- both Booking and Airbnb iCal links are manually confirmed current in Netlify configuration, without exposing their values;
- at least one recent successful persistent synchronization exists for each provider, and the expected late-October and late-December stays are present in `external_occupancies`;
- a maintenance window and rollback operator are available;
- explicit authorization to apply V4.7-A is recorded.

STOP immediately if any requirement above is false, if the backup cannot be verified, or if production changes after the pre-check in a way that invalidates its results.

## PHASE 7 — Apply corrected V4.7-A migration

Apply only `202609010001_v47a_atomic_direct_bookings.sql` through the approved Supabase migration mechanism. Do not apply V4.7-B in the same blind batch. Capture the exact migration output and duration without credentials.

On any error, STOP. Do not edit production data automatically and do not continue to V4.7-B.

## PHASE 8 — Immediate V4.7-A checks

Use read-only catalog queries to verify:

- `booking_requests_no_overlapping_local_blockers` exists, is an exclusion constraint, is validated, and has the exact partial predicate;
- `create_public_booking_request_atomic(jsonb,text,timestamptz)` exists as `SECURITY DEFINER`;
- `PUBLIC`, `anon`, and `authenticated` cannot execute it;
- `service_role` can execute it;
- the deployed RPC contains the provider-neutral one-night exclusion for both Booking and Airbnb;
- booking row counts and the pre-check anomaly counts have not changed unexpectedly;
- Stripe functions and tables remain present.

GO to V4.7-B only after these checks pass and explicit continuation is given.

## PHASE 9 — Apply V4.7-B migration

Apply only `202609010002_v47b_external_occupancy_conflicts.sql`. Capture output and duration. On error, STOP before any Git push.

## PHASE 10 — Immediate V4.7-B checks

Use read-only catalog queries to verify:

- both new tables and both indexes exist;
- RLS is enabled on both tables;
- table grants match service-role-only read/write-without-delete;
- all four functions exist as `SECURITY DEFINER` with the expected identity arguments;
- function execution is denied to `PUBLIC`, `anon`, and `authenticated`, and granted to `service_role`;
- both new tables are initially empty unless a separately observed scheduled run has already reconciled them;
- no booking, calendar block, external occupation, Stripe row, or analytics row was rewritten by the migrations.

GO to Git push only after these checks pass.

Apply `202609030001_revoke_anon_booking_insert.sql` after the V4.7 migrations and verify, using read-only catalog queries, that `anon` no longer has table `INSERT`, the obsolete public INSERT policy is absent, and service-role execution of the atomic RPC is unchanged. On any discrepancy, STOP before Git push.

## PHASE 11 — Push the reviewed local commits

Reconfirm that `main` ends at the recorded deployment HEAD, is zero behind `origin/main`, and has no tracked or indexed change. Push only after explicit authorization. Do not amend or squash validated commits, and do not add the two pre-deployment documents without separate authorization.

## PHASE 12 — Wait for automatic Netlify deployment

Do not start smoke tests while the deployment is building. Verify the deployed commit SHA is exactly the final HEAD recorded above, all required Netlify environment variables remain configured independently of the local fictitious `.env`, and every changed/new Netlify function built successfully.

## PHASE 13 — Production smoke tests

### V4.7-A

- Open the public form and load current availability without submitting.
- Submit a normal direct request only with owner-approved test dates and recipient, or defer this write test to the first legitimate reservation. Record the created booking ID and handle it manually according to normal business procedure; do not delete it silently.
- Submit a request against a known unavailable period and verify HTTP 409 / `DATE_CONFLICT`, the public message, no new booking row, and no owner/client booking email.
- Using an already persisted one-night Airbnb technical block, verify that the public calendar and final RPC both treat the dates consistently and that the technical row does not create a false `DATE_CONFLICT`. Do not create a platform reservation for this test.
- Do not manufacture a production double booking. Verify the exclusion constraint from catalog state and rely on the PostgreSQL 17 concurrency validation; if a production transaction test is later authorized, it must be isolated, rolled back, and must not invoke email code.

### V4.7-B

- Observe at least one normal scheduled run and verify Booking/Airbnb synchronization still updates `external_occupancies`.
- Verify the expected late-October and late-December platform reservations are persisted and appear on both public and owner calendars after page refresh.
- Verify the owner warning is absent after a recent successful run, appears when a provider has no success within 15 minutes, and an unreadable registry is never presented as verified availability.
- Verify existing current one-night Booking and Airbnb rows are absent from conflict rows and calendar/housekeeping stay projections.
- If the read-only pre-check identified a real overlap, verify exactly one OPEN row appears after reconciliation and one owner alert is sent. If no real conflict exists, do not create one merely to test production.
- Verify a repeated scheduled run preserves one conflict identity and does not resend a normal alert.
- As owner, call `get-external-occupancy-conflicts` and verify HTTP 200 with minimal non-PII fields.
- As housekeeping, verify the same endpoint is denied and no conflict data appears in housekeeping UI.
- Verify admin UI states:
  - successful empty result: no conflict banner;
  - real OPEN result: conflict banner and operational periods;
  - locally simulated network failure in browser tools: `Impossible de vérifier les conflits actuellement.`
- Verify no automatic cancellation, refund, booking status change, or platform-priority action occurred.

### Non-regressions

- Stripe V4.5: open finance admin views, verify aggregate values, and verify a normal Stripe status/read path without creating a refund.
- Analytics V4.6: record/observe a normal page view and confirm analytics remains append-only and admin aggregation loads.
- Calendar: public availability and admin calendar load; adjacent arrival/departure remains allowed.
- Housekeeping: read-only reservation list loads, one-night external technical blocks remain absent, conflict endpoint remains inaccessible.
- `calendar.ics`: fetch succeeds, exposes no PII, and blocking statuses remain unchanged.
- Critical Netlify functions: public calendar, public booking, owner conflict endpoint, scheduled external-calendar job, Stripe webhook route health, housekeeping read endpoint.

## PHASE 14 — Final V4.7 validation

Record migration results, deployed SHA, smoke-test evidence, remaining accepted risks, and the owner decision. V4.7 is final only after every production check is green. Keep `travail` with its fictitious `.env`; retain the separate operational snapshot under the owner's secret-handling rules.

## Rollback boundaries

- Before Git push, a V4.7-B migration failure leaves the old application operational. Do not improvise a partial schema repair; assess the captured error and backup first.
- Dropping V4.7-A protection while new code is deployed reopens the concurrency risk. Application rollback must precede database rollback.
- V4.7-B rollback order after application rollback: release/mark/claim/reconcile functions, `external_occupancy_conflicts`, then `external_occupancy_conflict_runs`.
- V4.7-A rollback order after application rollback: `create_public_booking_request_atomic`, then `booking_requests_no_overlapping_local_blockers`.
- Conflict history created after deployment must be exported/reviewed before any V4.7-B table drop. No automatic data deletion is authorized by this plan.

## Manual intervention points

- classify any unknown booking source;
- resolve any historical local-local overlap before V4.7-A;
- review invalid/null dates without automated rewriting;
- review every immediate external/local conflict and let the owner decide the operational outcome;
- authorize backup, each migration, Git push, and any write-based production smoke test separately;
- decide cancellation/refund manually if a genuine external conflict requires it.
