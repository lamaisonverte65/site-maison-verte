# Owner + Housekeeping Minimal Model Implementation Plan

> **Superseded in part:** Tasks 3 and 4 below describe the first local
> implementation and must not be executed for housekeeping mutations. Their
> corrective replacement is
> `docs/superpowers/plans/2026-08-28-housekeeping-readonly-notes.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace configurable administrative profiles with a fixed owner/housekeeping model and ensure a housekeeping browser receives only an allowlisted operational data contract.

**Architecture:** Supabase Auth identities bind to active `admin_users` rows primarily by Auth ID. A strict owner manages fixed housekeeping accounts; a dedicated authenticated Netlify boundary reads and mutates housekeeping data through explicit allowlists. SQL changes are additive and split around the known production owner/read-only repairs.

**Tech Stack:** Node.js test runner, JavaScript ESM, React 18, Netlify Functions, Supabase JS/PostgreSQL, Vite.

**Spec:** `docs/superpowers/specs/2026-08-28-owner-housekeeping-minimal-design.md`

## Global Constraints

- Work only in the `travail` workspace; never touch the frozen V4.2 backup.
- Perform no remote write, deployment, remote migration, commit, or push.
- Preserve all existing data; SQL is additive/non-destructive.
- Keep the production `read_only` row and historical `permissions` column for later controlled treatment.
- Ownership transfer is outside V4 and must not be exposed or implemented.
- Every behavior change follows red-green-refactor TDD.

---

### Task 1: Fixed role authorization and Auth binding

**Files:**
- Modify: `tests/admin-permissions.test.js`
- Modify: `tests/admin-auth.test.js`
- Modify: `tests/helpers/fakeSupabase.js`
- Modify: `shared/adminPermissions.js`
- Modify: `netlify/functions/_lib/admin-auth.js`
- Modify: `src/hooks/useAdminPermissions.js`

**Interfaces:**
- Produces: `isOwnerProfile(profile)`, `isHousekeepingProfile(profile)`, `getSystemCapabilities(profile)`, and `authorizeAdminRequest(event, supabase, options)`.
- `options.roles` accepts only explicit system roles; `ownerOnly` remains a convenience for strict-owner operations.

- [ ] Write tests proving unknown/legacy roles fail closed, owner and housekeeping capabilities ignore stored permissions, Auth ID is the primary lookup, mismatched IDs fail, and only the unique null-ID strict owner can use transitional email matching.
- [ ] Run `node --test tests/admin-permissions.test.js tests/admin-auth.test.js` and verify failures are caused by the old permission-mode/email-first behavior.
- [ ] Implement the fixed-role capability resolver and strict Auth lookup with owner-only transition.
- [ ] Run the focused tests and then `npm test` until green.

### Task 2: Owner-only housekeeping account policy and provisioning

**Files:**
- Modify: `tests/admin-user-policy.test.js`
- Modify: `tests/admin-user-service.test.js`
- Modify: `netlify/functions/_lib/admin-user-policy.js`
- Modify: `netlify/functions/_lib/admin-user-service.js`
- Modify: `netlify/functions/admin-users.js`

**Interfaces:**
- Produces: `validateCreateHousekeeping(requester, input)`, `validateHousekeepingUpdate(requester, target, updates)`, and `canResetHousekeepingPassword(requester, target)`.
- Creation output is `{ email, display_name, temporaryPassword, role: 'housekeeping' }` and never contains stored permissions.

- [ ] Replace obsolete policy tests with failures proving multiple housekeeping creation is allowed and role/permission/owner payload fields are rejected.
- [ ] Add failures proving housekeeping cannot list/create/update/deactivate/delete/reset users and generic actions cannot target owner.
- [ ] Run the focused tests and verify the old generic policy fails for the intended reasons.
- [ ] Implement the minimal policy, specialize provisioning to fixed housekeeping metadata, and remove transfer-only service code.
- [ ] Simplify the handler actions to `me`, `list`, `create_housekeeping`, `update_housekeeping`, `reset_housekeeping_password`, and `delete_housekeeping`; keep the controlled Auth-link operation server-owner-only only if required by the repair runbook.
- [ ] Run policy/service tests and the full suite until green.

### Task 3: Housekeeping backend contract

**Files:**
- Create: `tests/housekeeping-contract.test.js`
- Create: `netlify/functions/_lib/housekeeping-contract.js`
- Create: `netlify/functions/housekeeping.js`

**Interfaces:**
- Produces: `toHousekeepingReservation(row)` and `validateHousekeepingMutation(input)`.
- Endpoint actions: `list` returns `{ reservations }`; `update` accepts `{ reservationId, field, value }`.

- [ ] Write a failing serializer test with a fixture containing price, payment, refund, Stripe, payout, and technical fields; assert the literal safe contract and absence of every forbidden field.
- [ ] Write failing tests for separate `clientMessage`, `ownerReply`, `ownerForHousekeeping`, and `housekeeping` values.
- [ ] Write failing mutation tests accepting only `arrival_time`, `departure_time`, or `housekeeping_user_notes`, one at a time, and rejecting arbitrary fields or generic objects.
- [ ] Run `node --test tests/housekeeping-contract.test.js` and verify missing-module/behavior failures.
- [ ] Implement the pure serializer/validator, then the Netlify handler with explicit booking column selection and role authorization.
- [ ] Run the focused test and full suite until green.

### Task 4: Housekeeping frontend data flow

**Files:**
- Create: `tests/housekeeping-ui.test.js`
- Create: `src/services/housekeepingService.js`
- Modify: `src/pages/Admin.jsx`
- Modify: `src/components/CalendarAdmin.jsx`
- Modify: `src/components/admin/reservation/HousekeepingReservationView.jsx`

**Interfaces:**
- Produces: `fetchHousekeepingData(session)` and `updateHousekeepingField(session, reservationId, field, value)`.
- `CalendarAdmin` accepts `housekeepingReservations` and never loads customers, pricing, raw booking rows, payments, or Stripe data in housekeeping mode.

- [ ] Write failing service/adapter tests showing only the dedicated endpoint is called and update payloads use the restricted field contract.
- [ ] Run the UI-focused tests and verify failures.
- [ ] Branch the page data loader before `fetchAdminData`, use the housekeeping service, and prevent housekeeping-mode direct Supabase/pricing loads.
- [ ] Render separate communications/notes and editable arrival, departure, and housekeeping note controls.
- [ ] Run focused tests and the full suite until green.

### Task 5: Minimal users frontend

**Files:**
- Replace: `tests/admin-permission-form.test.js` with `tests/admin-users-ui.test.js`
- Modify: `src/hooks/useAdminUsers.js`
- Modify: `src/components/admin/users/UserCreatePanel.jsx`
- Modify: `src/components/admin/users/UsersPanel.jsx`
- Modify: `src/components/admin/users/UserRoleBadge.jsx`
- Remove from active imports: `src/utils/adminPermissionForm.js`, `src/components/admin/users/UserAccessMatrix.jsx`

**Interfaces:**
- User creation accepts `{ email, display_name, temporaryPassword }` only.
- User edits accept `{ display_name }` or `{ is_active }` only.

- [ ] Write failing UI state tests proving creation/update payloads cannot contain role or permission configuration.
- [ ] Run the focused test and verify old form helpers fail.
- [ ] Simplify hooks and components to one housekeeping creation flow and protected owner display.
- [ ] Remove role/mode selectors, matrices, transfer controls, and generic role editing.
- [ ] Run focused tests and the full suite until green.

### Task 6: Additive phased SQL migrations and runbook

**Files:**
- Move: `supabase/migrations/202608270002_admin_users_security.sql` to `docs/obsolete-migrations/202608270002_admin_users_security.sql`
- Move: `supabase/migrations/202608270003_validate_admin_users_security.sql` to `docs/obsolete-migrations/202608270003_validate_admin_users_security.sql`
- Create: `supabase/migrations/202608280001_owner_housekeeping_phase_a.sql`
- Create: `supabase/migrations/202608280002_owner_housekeeping_phase_b.sql`
- Modify: `docs/operations/admin-users-owner-repair.md`

**Interfaces:**
- Phase A applies without rewriting the known `read_only` or null-owner-Auth rows.
- Phase B aborts unless the controlled repairs are complete.

- [ ] Archive obsolete migrations outside the executable directory without deleting their content.
- [ ] Write Phase A with additive columns/indexes, guarded `NOT VALID` constraints/FK, RLS, and grants; include no permission mode or transfer RPC.
- [ ] Write Phase B precondition checks and final validations without deleting legacy rows or permission data.
- [ ] Rewrite the repair runbook around Auth linking only and explicitly require separate production authorization.
- [ ] Inspect both SQL files for `DROP`, `TRUNCATE`, data `DELETE`, permission-mode, or transfer-RPC statements and remove any occurrence.

### Task 7: Final verification and diff audit

**Files:** all modified files.

- [ ] Run `npm test` and record total passing tests.
- [ ] Parse-check every `netlify/functions/**/*.js` file with `node --check`.
- [ ] Run `npm run build` and confirm Vite succeeds.
- [ ] Run `git diff --check`.
- [ ] Inspect `git status --short`, `git diff --stat`, and the complete diff, confirming unrelated pre-existing changes were not overwritten.
- [ ] Confirm the executable migration directory no longer contains obsolete 002/003, no remote command was used, and no deployment or migration was executed.
