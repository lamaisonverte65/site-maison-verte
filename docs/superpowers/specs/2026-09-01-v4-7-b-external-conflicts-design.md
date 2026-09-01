# V4.7-B External Occupancy Conflicts Design

## Scope

V4.7-B detects a persisted Booking or Airbnb occupation that overlaps a local blocking occupation, records the conflict, alerts the owner, and leaves resolution entirely manual. It never cancels, refunds, prioritizes, or mutates either occupation.

The existing V4.7-A direct-booking invariant, Stripe V4.5, analytics V4.6, RES-02, pricing, and general iCal behavior remain unchanged.

## Existing boundaries reused

- `external_occupancies` remains the canonical persistent Booking/Airbnb registry.
- `check-external-calendar-alerts` remains the five-minute scheduled synchronization job.
- A failed source is absent from `successfulSources`; its occupations and conflicts are never retired or resolved during that run.
- `external_calendar_actions` remains a manual transformation journal and is not reused for conflicts.
- `calendar_blocks` is a real local blocker because the public calendar and V4.7-A availability RPC already treat every stored block as unavailable.
- The existing claim/send/mark-or-release alert pattern is retained, with a dedicated atomic database claim for conflict alerts.

## Conflict definition

Periods use `[start_date, end_date)`. A conflict exists when `external.start_date < local.end_date` and `external.end_date > local.start_date`.

External candidates are current `booking` or `airbnb` rows. Every one-night external row (`end_date = start_date + 1`) is a technical block and is excluded without inspecting its title, summary, or UID.

Local candidates are:

- `booking_requests` in `pending`, `accepted`, `deposit_paid`, `paid`, `fully_paid`, or `confirmed`, whose source is `NULL`, `direct`, `admin_client`, or `admin_personal`;
- every valid `calendar_blocks` row, matching its existing blocking semantics.

Adjacent periods are not conflicts. Refused, expired, and cancelled booking requests are excluded by the closed status allowlist.

## Durable model

Create `external_occupancy_conflicts` with one row per stable identity `(external_occupancy_id, local_kind, local_id)`. The row stores only identifiers, source, UID, date snapshots, lifecycle timestamps, occurrence count, and alert delivery state. It contains no guest, contact, message, or financial data.

Lifecycle:

- new overlap: `open`, occurrence `1`, alert `pending`;
- persistent overlap: same row, update `last_detected_at`, preserve sent alert state;
- absent after a successful source synchronization: `resolved`, set `resolved_at`;
- reappearance: `open`, increment occurrence, reset alert to `pending`.

Rows are never automatically deleted. Local targets are polymorphic snapshots rather than foreign keys so historical conflicts survive later local deletion. The external target uses a restrictive foreign key because external occupations are already retained historically.

## Atomic database operations

`reconcile_external_occupancy_conflicts(source, detected_at)` is a service-role-only transaction. It derives all current pairs from persisted tables, upserts them under the unique identity, and resolves open rows for only the supplied successfully synchronized source when their pair no longer exists.

`claim_external_occupancy_conflict_alerts(limit, now, timeout)` atomically claims pending, retryable, or expired claims with `FOR UPDATE SKIP LOCKED`. Concurrent scheduled jobs receive disjoint rows.

The scheduled job imports and retires external occupations first, reconciles each successful source, then claims and sends conflict alerts. A conflict never blocks or rolls back the preceding external import.

## Email

One email is sent per claimed conflict. This keeps per-conflict idempotence simple. The subject is `Alerte — chevauchement de réservation détecté`. The body contains only source, external period, local kind and period, and the instruction that human intervention is necessary. It may state that cancellation or refund could be required, but triggers neither.

Successful delivery changes `claimed` to `sent`. Failure changes it to `retry`. An abandoned `claimed` row becomes claimable after the timeout. A provider success followed by a database failure can still cause a duplicate retry; exact-once delivery is not promised.

## Owner UI and security

A new owner-only Netlify endpoint reads explicit non-PII columns for open conflicts through `service_role`. Housekeeping and unauthenticated callers are rejected by the existing admin authorization boundary. Browser roles receive no direct table privileges.

`CalendarAdmin` loads this endpoint only in owner/admin mode and reuses `CalendarConflictDialog` as a compact warning above the calendar. It shows source and both periods. A booking-request conflict can open the existing local reservation panel; calendar blocks remain identifiable without a new workflow. A load error is visible rather than silently represented as no conflicts.

## Validation

Node tests cover detection orchestration, one-night exclusion contract, lifecycle and email behavior, owner-only UI projection, and migration security structure. PostgreSQL 17 tests apply the migration to a disposable prerequisite schema and exercise overlap semantics, lifecycle, uniqueness, concurrent reconciliation/claiming, and role grants. Final checks include V4.7-B tests, V4.7-A tests, the complete suite, Vite build, Netlify syntax, diff checks, secret scan, and protected-file scope checks.

No commit, push, deployment, or production migration is part of V4.7-B.
