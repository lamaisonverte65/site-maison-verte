# V4.1 Security First Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close SEC-01, AUTH-03, AUTH-01, AUTH-04, SEC-05, and SEC-02 while preserving the public booking and account-free arrival-time journeys.

**Architecture:** Introduce small shared, testable security modules for permissions, server authorization, HTML/input validation, and capability tokens. Netlify handlers consume those modules and keep external Supabase, Resend, and Stripe calls at the boundary. React consumes the same permission vocabulary and sends only the reduced public/admin payloads.

**Tech Stack:** React 18, Vite 5, Netlify Functions, Node.js built-in test runner, Supabase JS, Resend HTTP API, Stripe.

**Spec:** `docs/superpowers/specs/2026-08-26-v4-1-security-first-pass-design.md`

## Global Constraints

- Work only in V4.1.
- Do not commit, push, deploy, call production Supabase/Resend/Stripe, or change external production configuration.
- Add no secret to the repository or frontend bundle.
- Keep RLS, Stripe finance behavior, iCal business behavior, and unrelated refactors out of scope.

---

### Task 1: Shared fail-closed authorization

**Files:**
- Create: `shared/adminPermissions.js`
- Create: `netlify/functions/_lib/admin-auth.js`
- Modify: `src/utils/adminPermissions.js`
- Test: `tests/admin-auth.test.js`
- Test: `tests/admin-permissions.test.js`

**Interfaces:**
- Produces `ADMIN_ROLES`, `ADMIN_PERMISSIONS`, `getDefaultPermissionsForRole`, `getEffectivePermissions`, `isOwnerProfile`, and `authorizeAdminRequest(event, supabase, { anyOf })`.

- [ ] Write tests for missing session, invalid session, missing profile, inactive profile, read-only, housekeeping, delegated permission, and strict owner detection.
- [ ] Run the tests and confirm they fail because the shared modules do not exist.
- [ ] Implement the shared permission model and server authorization helper.
- [ ] Update the React utility to fail closed for unknown/absent profiles.
- [ ] Run the focused tests until green.

### Task 2: User-management escalation and enumeration

**Files:**
- Create: `netlify/functions/_lib/admin-user-policy.js`
- Modify: `netlify/functions/admin-users.js`
- Modify: `src/hooks/useAdminUsers.js`
- Modify: `src/hooks/useAdminPermissions.js`
- Modify: `src/pages/Admin.jsx`
- Modify: `src/components/admin/users/UserCreatePanel.jsx`
- Modify: `src/components/admin/users/UsersPanel.jsx`
- Modify: `src/components/admin/users/UserAccessMatrix.jsx`
- Test: `tests/admin-user-policy.test.js`

**Interfaces:**
- `validateCreateUser(requesterProfile, input)` and `validateUserUpdate(requesterProfile, target, updates)` return sanitized values or a denial.
- `admin-users` action `me` returns only the current profile plus `canListUsers`; action `list` requires `view:users`.

- [ ] Write failing tests for owner creation/promotion, self-promotion, forbidden permission delegation, owner reset by non-owner, and legitimate owner operations.
- [ ] Implement strict role/permission validation and target-owner guards.
- [ ] Split `me` from `list` and update React loading so non-listing roles do not enumerate accounts.
- [ ] Run focused tests until green.

### Task 3: Public and administrative email relay controls

**Files:**
- Create: `netlify/functions/_lib/html.js`
- Create: `netlify/functions/_lib/public-booking.js`
- Modify: `netlify/functions/send-booking-request.js`
- Modify: `src/pages/MaisonVerte.jsx`
- Modify: `netlify/functions/send-manual-payment-email.js`
- Modify: `netlify/functions/create-manual-payment-session.js`
- Modify: `netlify/functions/send-booking-decision.js`
- Test: `tests/public-booking.test.js`
- Test: `tests/admin-email.test.js`

**Interfaces:**
- `validatePublicBookingPayload(input)` returns a normalized booking insert and email view model.
- Public endpoint accepts only booking fields plus honeypot/timing metadata; administrative endpoints accept booking IDs and permitted business choices, never arbitrary recipients or links.

- [ ] Write failing tests for anonymous administrative relay, unknown/oversized public fields, HTML injection, fixed recipients/templates, and normal public submission.
- [ ] Implement strict validation, escaping, duplicate suppression, and Netlify rate-limit configuration.
- [ ] Make the public function create the booking row and make React call only that function.
- [ ] Protect administrative senders and re-read booking recipients/details from Supabase.
- [ ] Run focused tests until green.

### Task 4: Replace every fail-open privileged check

**Files:**
- Modify: `netlify/functions/apply-external-calendar-action.js`
- Modify: `netlify/functions/create-personal-booking.js`
- Modify: `netlify/functions/create-balance-checkout-session.js`
- Modify: `netlify/functions/create-checkout-session.js`
- Modify: `netlify/functions/delete-booking-request.js`
- Modify: `netlify/functions/refund-booking-payment.js`
- Modify: `netlify/functions/save-price-rule.js`
- Modify: `netlify/functions/update-booking-request.js`
- Modify: `netlify/functions/update-external-reservation-client.js`

**Interfaces:**
- Every handler calls `authorizeAdminRequest` with the smallest existing business permission before privileged work.

- [ ] Replace duplicated `ADMIN_EMAIL(S)` checks with the shared helper.
- [ ] Preserve housekeeping's notes-only branch while requiring an active profile.
- [ ] Run authorization tests and syntax-check every changed function.

### Task 5: Arrival-time capability token

**Files:**
- Create: `netlify/functions/_lib/arrival-token.js`
- Create: `supabase/migrations/202608260001_add_arrival_time_tokens.sql`
- Modify: `netlify/functions/send-arrival-reminder.js`
- Modify: `netlify/functions/update-arrival-time.js`
- Modify: `src/App.jsx`
- Test: `tests/arrival-token.test.js`

**Interfaces:**
- `createArrivalToken(booking)` returns `{ token, hash, expiresAt }`.
- `verifyArrivalCapability({ booking, bookingId, token, arrivalTime, now })` returns a normalized `HH:MM` or a denial.

- [ ] Write failing tests for booking ID alone, valid/invalid/cross-booking/expired tokens, invalid time, and ineligible bookings.
- [ ] Implement token generation, hashing, constant-time verification, eligibility, and strict time validation.
- [ ] Store only the hash and update the reminder URL/frontend form.
- [ ] Run focused tests until green.

### Task 6: Scheduled external-calendar alert protection

**Files:**
- Create: `netlify/functions/_lib/external-calendar-alerts.js`
- Modify: `netlify/functions/check-external-calendar-alerts.js`
- Modify: `netlify.toml`
- Test: `tests/external-calendar-alerts.test.js`

**Interfaces:**
- The deployed function is scheduled-only; `claimMissingAlerts(repository, actions)` atomically claims each row before email.

- [ ] Write failing tests showing duplicate concurrent claims produce one sendable alert set.
- [ ] Convert the handler to `schedule(...)` and register its cron in `netlify.toml`.
- [ ] Add atomic claim/reset behavior around email sending.
- [ ] Run focused tests until green.

### Task 7: Full verification and report evidence

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` only if npm changes it mechanically.

- [ ] Add `test` and Netlify syntax-check scripts using existing local tooling only.
- [ ] Run all tests.
- [ ] Run the Vite build.
- [ ] Syntax-check all Netlify functions.
- [ ] Search again for fail-open allowlists, owner assignment paths, unprotected service-role/Resend endpoints, and frontend references to scheduler secrets.
- [ ] Scan tracked changes for secret-like values.
- [ ] Review `git diff --check`, `git diff --stat`, full `git diff`, and `git status`.
- [ ] Confirm every changed path is inside V4.1 and prepare the mandatory nine-section report.
