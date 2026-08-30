# Housekeeping Read-Only and Append-Only Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make housekeeping strictly read-only for business data while allowing authenticated append-only notes bound to persisted direct or external stays.

**Architecture:** A local `external_occupancies` registry provides deterministic external targets. A separate `housekeeping_notes` table and authenticated Netlify endpoint own append-only note writes; the existing housekeeping endpoint becomes an explicit-column read projection with no remote dependency.

**Tech Stack:** Node.js test runner, JavaScript ESM, React 18, Netlify Functions, Supabase JS/PostgreSQL, Vite.

**Spec:** `docs/superpowers/specs/2026-08-28-housekeeping-readonly-notes-design.md`

## Global Constraints

- Work in the current dirty checkout because it contains the uncommitted owner/housekeeping refactor being corrected.
- Do not contact remote services, use real secrets, deploy, apply migrations, commit, or push.
- SQL is additive and preserves historical reservation-note fields and data.
- Housekeeping writes only a new append-only note through a dedicated authenticated endpoint.
- Every production behavior change follows a witnessed red-green TDD cycle.

---

### Task 1: Correct the pure housekeeping contract

**Files:**
- Modify: `tests/housekeeping-contract.test.js`
- Modify: `netlify/functions/_lib/housekeeping-contract.js`

**Interfaces:**
- Produces `toHousekeepingReservation(row, notes)`, `toHousekeepingExternalReservation(occupation, linked, notes)`, `validateHousekeepingNoteInput(input)`, and `parseHousekeepingReservationTarget(value)`.
- Removes `validateHousekeepingMutation` and every mutable reservation field.

- [ ] Replace the owner-message and mutation tests with failures proving `owner_message` is absent, iCal summary is not a guest name, missing external fields remain null, financial fields are excluded, and only `{ reservationId, note }` is accepted.
- [ ] Run `node --test tests/housekeeping-contract.test.js`; expect failures because owner replies and reservation mutations still exist.
- [ ] Implement the minimal allowlisted serializer and append-note validator:

```js
export function validateHousekeepingNoteInput(input = {}) {
  if (Object.keys(input).some((key) => !["reservationId", "note"].includes(key))) return fail("Attribut non autorisé.");
  const reservationId = String(input.reservationId || "").trim();
  const note = String(input.note || "").trim();
  if (!reservationId || !note || note.length > 2000) return fail("Note ménage invalide.");
  return { ok: true, value: { reservationId, note } };
}
```

- [ ] Re-run the focused test until green.

### Task 2: Add the note service with deterministic local targets

**Files:**
- Create: `tests/housekeeping-notes.test.js`
- Create: `netlify/functions/_lib/housekeeping-notes.js`
- Create: `netlify/functions/housekeeping-notes.js`

**Interfaces:**
- Produces `createHousekeepingNote({ repository, author, input })` and `listHousekeepingNotes({ repository, target })`.
- Repository methods are `directTargetExists(id)`, `externalTargetExists(source, uid)`, `insertNote(row)`, and `listNotes(target)`.

- [ ] Write failing tests for direct existence, external persisted existence, arbitrary UID rejection, author binding from the authenticated profile, rejection of supplied author/mutation fields, append-only behavior, housekeeping access, owner access, and absence of communication/email side effects.
- [ ] Run `node --test tests/housekeeping-notes.test.js`; expect a missing-module failure.
- [ ] Implement the pure service and an endpoint supporting only `create` and `list`. The insert must be:

```js
{
  booking_request_id: direct ? id : null,
  external_source: external ? source : null,
  external_uid: external ? uid : null,
  author_admin_user_id: author.id,
  note,
}
```

- [ ] Re-run focused tests until green.

### Task 3: Make the housekeeping endpoint read-only and locally backed

**Files:**
- Modify: `tests/housekeeping-contract.test.js`
- Modify: `netlify/functions/housekeeping.js`
- Modify: `netlify/functions/_lib/housekeeping-contract.js`

**Interfaces:**
- `housekeeping.js` accepts only `{ action: "list" }`.
- External occupations are selected from `external_occupancies`; no iCal library or URL is read by this endpoint.

- [ ] Add failures proving external rows originate from persisted occupation records and unknown actions cannot write.
- [ ] Run the focused test and verify the old remote/mutation path fails it.
- [ ] Replace iCal fetching and update logic with explicit selects from `booking_requests`, `external_occupancies`, `external_reservation_clients`, `housekeeping_notes`, and note-author display names.
- [ ] Re-run focused and complete tests until green.

### Task 4: Remove legacy housekeeping mutation paths

**Files:**
- Modify: `tests/admin-auth.test.js`
- Modify: `netlify/functions/update-booking-request.js`
- Modify: `netlify/functions/update-external-reservation-client.js`

**Interfaces:**
- Both legacy endpoints require owner management capabilities before any mutation.
- No `role === "housekeeping"` exception or `housekeeping_user_notes` update mode remains active.

- [ ] Add focused authorization failures for housekeeping attempts to mutate a reservation or external client.
- [ ] Run the focused tests and confirm the former role exception is unsafe.
- [ ] Remove the exceptions and authorize only owner management capabilities.
- [ ] Re-run focused and complete tests until green.

### Task 5: Make the housekeeping UI read-only except note append

**Files:**
- Modify: `tests/housekeeping-ui.test.js`
- Modify: `src/services/housekeepingService.js`
- Modify: `src/components/admin/reservation/HousekeepingReservationView.jsx`
- Modify: `src/pages/Admin.jsx`

**Interfaces:**
- Produces `createHousekeepingNote({ accessToken, reservationId, note })`.
- Removes `updateHousekeepingField`.

- [ ] Write failures proving no reservation-update request is emitted, note creation uses `housekeeping-notes` with `{ action: "create", reservationId, note }`, and rendered arrival/departure fields are not editable.
- [ ] Run `node --test tests/housekeeping-ui.test.js`; expect failures against the old update service.
- [ ] Replace time inputs and prefilled editable note with read-only text, immutable note history, and a blank append form.
- [ ] Re-run focused and complete tests until green.

### Task 6: Persist external occupations during the existing scheduled sync

**Files:**
- Modify: `tests/external-calendar-alerts.test.js`
- Modify: `netlify/functions/_lib/external-calendar-alerts.js`
- Modify: `netlify/functions/check-external-calendar-alerts.js`

**Interfaces:**
- Produces `persistExternalOccupancies(repository, occupations, seenAt)`.
- The scheduled function upserts `{ source, external_uid, start_date, end_date, first_seen_at, last_seen_at, updated_at }` only after a successful source read.

- [ ] Write failures proving source/UID/date persistence, duplicate idempotency, and no inferred guest or financial fields.
- [ ] Run the focused test and expect missing behavior.
- [ ] Extend the existing scheduled flow to persist normalized occupations before missing-alert checks; do not invoke it during validation.
- [ ] Re-run focused and complete tests until green.

### Task 7: Remove generic Auth linking

**Files:**
- Modify: `tests/admin-user-service.test.js`
- Modify: `netlify/functions/_lib/admin-user-service.js`
- Modify: `netlify/functions/admin-users.js`

**Interfaces:**
- `admin-users.js` no longer accepts `link_existing_auth`.
- The owner repair runbook remains unchanged and outside the API.

- [ ] Replace the generic-link success test with an active-action allowlist test.
- [ ] Run the focused test and verify the old action remains reachable.
- [ ] Remove the adapter, service export, import, and action branch.
- [ ] Re-run focused and complete tests until green.

### Task 8: Prepare additive SQL

**Files:**
- Modify: `supabase/migrations/202608280001_owner_housekeeping_phase_a.sql`
- Create: `supabase/migrations/202608280003_housekeeping_notes.sql`

**Interfaces:**
- Creates `external_occupancies` with `unique(source, external_uid)`.
- Creates `housekeeping_notes` with direct and composite external foreign keys and an exactly-one-target check.

- [ ] Remove only the unapplied Phase A additions whose sole purpose was mutable `housekeeping_user_notes`; preserve every historical field and datum.
- [ ] Add the two new tables, indexes, constraints, RLS, and revocations without `DROP`, `TRUNCATE`, data `DELETE`, or rewrite.
- [ ] Inspect SQL text and verify Phase B remains compatible.

### Task 9: Document external enrichment and final validation

**Files:**
- Modify: `docs/superpowers/specs/2026-08-28-owner-housekeeping-minimal-design.md`
- Modify: `docs/superpowers/plans/2026-08-28-owner-housekeeping-minimal.md`

**Interfaces:**
- Marks the older mutation sections superseded and documents current iCal limits plus future qualified sources.

- [ ] Update the earlier documents so no active local specification instructs housekeeping reservation mutation.
- [ ] Run `npm test` and record the total.
- [ ] Run `node --check` for every `netlify/functions/**/*.js` file.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Inspect `git status --short`, `git diff --stat`, and the complete diff; confirm no remote command, secret use, deployment, migration execution, commit, or push occurred.
