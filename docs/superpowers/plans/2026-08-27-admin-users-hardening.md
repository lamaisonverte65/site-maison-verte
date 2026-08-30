# V4 Admin Users Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four audited `admin_users` vulnerabilities locally and prepare, without applying, the production schema and owner-data repairs.

**Architecture:** Keep `admin_users` as the sole authority source and Supabase Auth as identity. Centralize explicit permission-mode resolution and reset hierarchy in pure shared/policy functions, isolate Auth/database side effects behind a testable administration service, and move ownership changes into a service-role-only PostgreSQL transaction followed by explicit Auth metadata synchronization.

**Tech Stack:** React 18, Vite 5, Netlify Functions, Node.js built-in test runner, Supabase JS/PostgREST, PostgreSQL/PLpgSQL.

**Spec:** `docs/superpowers/specs/2026-08-27-admin-users-hardening-design.md`

## Global Constraints

- Work exclusively in `C:\Users\pc\Desktop\Site La MaisonVerte\Site Maison Verte - V4\travail`.
- Do not write to production Supabase or Supabase Auth.
- Do not commit, push, deploy, send email, call Stripe, or modify external configuration.
- Do not introduce `ADMIN_EMAIL` or `ADMIN_EMAILS`, owner creation through generic actions, frontend-only authorization, or fail-open behavior.
- Preserve all existing production-profile behavior during migration; historical `permissions = []` maps to `permission_mode = role`, never `none`.
- Stop after local verification and request explicit authorization before any remote write.

---

### Task 1: Explicit permission modes and strict reset hierarchy

**Files:**
- Modify: `shared/adminPermissions.js`
- Modify: `netlify/functions/_lib/admin-user-policy.js`
- Modify: `tests/admin-permissions.test.js`
- Modify: `tests/admin-user-policy.test.js`

**Interfaces:**
- Produces `ADMIN_PERMISSION_MODES`, `resolvePermissionMode(profile)`, `getEffectivePermissions(profile)`, and `hasStrictlyGreaterPrivileges(requester, target)`.
- `validateCreateUser` and `validateUserUpdate` return sanitized `permission_mode` and `permissions`.
- `canResetPassword(requester, target)` enforces strict owner/self/proper-superset rules.

- [ ] **Step 1: Write failing permission-mode tests**

Add tests proving `role` inherits defaults, `custom` uses only its explicit non-empty allowlisted list, `none` returns an empty set, legacy empty arrays retain role defaults, legacy non-empty arrays retain custom behavior, and unknown modes or invalid stored values fail closed.

- [ ] **Step 2: Run the focused permission tests and verify RED**

Run: `node --test tests/admin-permissions.test.js`

Expected: failures because `ADMIN_PERMISSION_MODES` and explicit mode resolution do not exist and `[]` cannot yet mean `none`.

- [ ] **Step 3: Implement minimal shared resolution**

Add frozen mode constants and resolve permissions with these exact branches: strict owner → all; invalid/inactive/owner-incoherent → none; missing mode → legacy array semantics; `role` → defaults; `custom` → a non-empty, entirely allowlisted unique array or none on malformed storage; `none` → none; housekeeping accepts only legacy/role.

- [ ] **Step 4: Run the focused permission tests and verify GREEN**

Run: `node --test tests/admin-permissions.test.js`

Expected: all permission tests pass.

- [ ] **Step 5: Write failing policy tests**

Add tests proving create/update validates `permission_mode`, rejects empty/unknown custom lists, stores `[]` for none, prevents non-owner delegation, forces owner protection and housekeeping role mode, denies self reset, denies peer reset, denies incomparable sets, permits a proper-superset non-owner with `manage:users`, and permits the strict owner's supported resets.

- [ ] **Step 6: Run the policy tests and verify RED**

Run: `node --test tests/admin-user-policy.test.js`

Expected: failures because the current reset check allows peers and policy inputs have no explicit permission mode.

- [ ] **Step 7: Implement strict policy validation**

Implement identity equality by profile ID, Auth ID, or normalized email; proper-superset comparison over effective permission sets; explicit mode sanitization; custom delegation checks; and owner/housekeeping invariants. Keep generic owner mutation refused.

- [ ] **Step 8: Run both focused suites and verify GREEN**

Run: `node --test tests/admin-permissions.test.js tests/admin-user-policy.test.js`

Expected: both suites pass.

### Task 2: Safe Auth provisioning and existing-identity association

**Files:**
- Create: `netlify/functions/_lib/admin-user-service.js`
- Create: `tests/admin-user-service.test.js`
- Modify: `netlify/functions/admin-users.js`

**Interfaces:**
- Produces `provisionAdminUser({ repository, auth, profile, createdBy })` returning `{ ok, ... }` without mutating existing identities.
- Produces `linkExistingAuthUser({ repository, auth, targetId, authUserId })` for an already owner-authorized caller.
- Repository methods: `findProfileByEmail(email)`, `findProfileByAuthId(authUserId)`, `insertProfile(profile)`, `linkAuthId(targetId, authUserId)`.
- Auth methods: `findUserByEmail(email)`, `getUserById(id)`, `createUser(attributes)`, `deleteUser(id)`.

- [ ] **Step 1: Write failing provisioning tests**

Cover existing profile conflict with zero Auth mutations, existing Auth conflict with zero password/metadata mutation, new Auth plus successful insert, insert failure plus successful deletion of only the newly created Auth account, and insert plus compensation failure returning explicit reconciliation state.

- [ ] **Step 2: Run the service test and verify RED**

Run: `node --test tests/admin-user-service.test.js`

Expected: module-not-found failure for the service.

- [ ] **Step 3: Implement minimal provisioning service**

Implement the ordered preflight/create/insert/compensate flow. Return safe status codes and messages; retain the created Auth ID only inside the service result needed for manual reconciliation.

- [ ] **Step 4: Run provisioning tests and verify GREEN**

Run: `node --test tests/admin-user-service.test.js`

Expected: provisioning cases pass.

- [ ] **Step 5: Write failing association tests**

Cover missing target, target already linked, missing Auth user, email mismatch, Auth ID used by another profile, and exact-match success that updates only `auth_user_id`.

- [ ] **Step 6: Run association tests and verify RED**

Run: `node --test tests/admin-user-service.test.js`

Expected: new association cases fail because the operation is absent.

- [ ] **Step 7: Implement association and wire server adapters**

Add the pure service operation and adapt `admin-users.js` to use Supabase queries and Auth Admin methods. Generic create uses `insert`, never `upsert` or `updateUserById`. Add owner-only `link_existing_auth`; its body accepts target profile ID and Auth user ID but requester identity comes only from the verified session.

- [ ] **Step 8: Run service and policy suites**

Run: `node --test tests/admin-user-service.test.js tests/admin-user-policy.test.js`

Expected: all pass.

### Task 3: Transactional ownership transfer and Auth synchronization

**Files:**
- Modify: `netlify/functions/_lib/admin-user-service.js`
- Modify: `tests/admin-user-service.test.js`
- Modify: `netlify/functions/admin-users.js`
- Create: `tests/admin-users-sql.test.js`
- Create: `supabase/migrations/202608270002_admin_users_security.sql`

**Interfaces:**
- Produces `transferOwnership({ repository, auth, requester, targetId })` where requester was already authenticated and strictly authorized by the handler.
- Repository method `transferOwnershipAtomically({ expectedOwnerId, expectedOwnerAuthUserId, targetId })` calls `transfer_admin_ownership`.
- Produces `synchronizeAuthMetadata({ repository, auth })`, idempotently aligning known linked profiles.
- RPC returns old/new owner profile and Auth identifiers plus roles/display names.

- [ ] **Step 1: Write failing transfer-orchestration tests**

Prove that requester IDs passed to the repository come from the verified requester object, missing requester Auth ID fails before RPC, target ID is the only client-selected identity, RPC failure performs no Auth update, successful RPC synchronizes both Auth users, and any Auth failure returns `ownershipTransferred: true` plus `authSyncRequired: true`.

- [ ] **Step 2: Run service tests and verify RED**

Run: `node --test tests/admin-user-service.test.js`

Expected: transfer tests fail because the orchestration does not exist.

- [ ] **Step 3: Implement transfer orchestration and idempotent sync**

Call the transactional repository only after strict requester fields are present. Preserve unrelated Auth metadata when updating `admin_role` and `display_name`. Collect every sync failure and never report full success when failures exist. Implement owner-only handler actions `transfer_owner` and `sync_auth_metadata`.

- [ ] **Step 4: Run service tests and verify GREEN**

Run: `node --test tests/admin-user-service.test.js`

Expected: transfer and sync tests pass.

- [ ] **Step 5: Write failing SQL invariant tests**

Read the migration text and assert that it defines `permission_mode`, the role/mode/owner checks, unique normalized email/Auth ID/owner indexes, a row-locking `transfer_admin_ownership` function, expected-owner Auth-ID verification, revocation from `public`, `anon`, and `authenticated`, and execute grant only to `service_role`.

- [ ] **Step 6: Run SQL tests and verify RED**

Run: `node --test tests/admin-users-sql.test.js`

Expected: failure because the migration is absent.

- [ ] **Step 7: Create the additive, unapplied migration**

Add nullable `permission_mode`, behavior-preserving backfill, then make the mode non-null. Add guarded allowlist/coherence checks and unique indexes. Add the permissions-array check as `NOT VALID` because the audited owner still stores `{}`. Define the transaction RPC with locked owner/target reads, exact owner-count and server-derived identity checks, atomic demotion/promotion, and service-role-only execution. Enable RLS and revoke table access from `anon` and `authenticated`, subject to catalog re-verification before eventual application.

- [ ] **Step 8: Run SQL tests and verify GREEN**

Run: `node --test tests/admin-users-sql.test.js`

Expected: all SQL invariants pass without connecting to Supabase.

### Task 4: React and API permission-mode integration

**Files:**
- Modify: `netlify/functions/admin-users.js`
- Modify: `src/components/admin/users/UserCreatePanel.jsx`
- Modify: `src/components/admin/users/UsersPanel.jsx`
- Modify: `src/components/admin/users/UserAccessMatrix.jsx`
- Modify: `src/hooks/useAdminUsers.js` only if the request/response shape needs adaptation
- Create: `tests/admin-permission-ui.test.js`

**Interfaces:**
- API public profiles include `permission_mode`.
- Create/update payloads include `permission_mode` and a permission array.
- UI mode selector maps role → disabled default preview, custom → enabled non-empty matrix, none → disabled empty matrix.

- [ ] **Step 1: Write failing source-level UI contract tests**

Assert that create and edit flows expose all three mode labels, housekeeping remains fixed, custom enables the matrix, none clears permissions, and API public fields include `permission_mode`.

- [ ] **Step 2: Run UI tests and verify RED**

Run: `node --test tests/admin-permission-ui.test.js`

Expected: failures because the interface has no mode selector.

- [ ] **Step 3: Implement the minimal UI/API integration**

Add explicit mode state and accessible select labels. Render inherited permission previews without making them editable, require at least one custom selection, and send `[]` for none. Preserve owner non-editability and the fixed housekeeping creation path.

- [ ] **Step 4: Run UI, permission, and policy suites**

Run: `node --test tests/admin-permission-ui.test.js tests/admin-permissions.test.js tests/admin-user-policy.test.js`

Expected: all pass.

### Task 5: Owner repair and schema-finalization runbooks

**Files:**
- Create: `docs/operations/admin-users-owner-repair.md`
- Create: `supabase/migrations/202608270003_validate_admin_users_security.sql`
- Modify: `tests/admin-users-sql.test.js`

**Interfaces:**
- Runbook contains masked logical values and parameterized SQL/preconditions, not production secrets or complete personal identifiers.
- Finalization migration validates the previously `NOT VALID` permissions constraint and applies remaining strict null/FK guarantees only after repair.

- [ ] **Step 1: Write failing finalization/runbook checks**

Assert the finalization migration validates the permissions-array constraint and the runbook includes backup, exact preconditions, conditional repair, zero-row abort, rollback, post-write identity/owner checks, and the mandatory authorization stop.

- [ ] **Step 2: Run SQL tests and verify RED**

Run: `node --test tests/admin-users-sql.test.js`

Expected: failures because the finalization and runbook files do not exist.

- [ ] **Step 3: Prepare the unapplied artifacts**

Write a parameterized transaction that sets the audited owner's unique Auth ID, `permissions = []`, and `permission_mode = role` only when the saved old state still matches. Document backup and conditional rollback. Add the validation migration with explicit preflight exceptions. Do not include actual email, UUID, token, or key.

- [ ] **Step 4: Run SQL tests and verify GREEN**

Run: `node --test tests/admin-users-sql.test.js`

Expected: all local artifact checks pass.

### Task 6: Full local verification and mandatory stop

**Files:**
- Review all files changed by Tasks 1–5.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: zero failures.

- [ ] **Step 2: Syntax-check Netlify functions**

Run each changed Netlify JavaScript file with `node --check`.

Expected: zero syntax errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: successful Vite build, or report the exact environmental blocker without claiming success.

- [ ] **Step 4: Run security searches**

Search for `ADMIN_EMAIL`, generic owner assignment, `upsert`/`updateUserById` in create flow, direct transfer updates, and frontend-only reset checks. Inspect every match.

- [ ] **Step 5: Review changes and workspace scope**

Run `git diff --check`, inspect the focused diff and `git status`, and verify no file outside the authorized workspace changed. Do not commit.

- [ ] **Step 6: Produce the stop report**

Report design, modified files, unapplied migrations, new tests, exact test/build evidence, masked owner corrections, before/after controls, and residual risks. End exactly with `Corrections locales prêtes — autorisation requise avant toute écriture Supabase`.
