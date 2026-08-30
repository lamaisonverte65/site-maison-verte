# V4 Admin Users Hardening Design

## Scope

This design closes the four `admin_users` application vulnerabilities found by the static audit and prepares the production-owner data repair found by the read-only production audit. Work in this phase is local only. It must not write to production Supabase, Supabase Auth, Netlify, Stripe, Resend, or any other remote system. It must not commit, push, deploy, or modify the frozen V4.1 backup.

The existing security boundary remains unchanged: Supabase Auth proves identity, while an active `admin_users` profile is the sole source of administrative authority. `ADMIN_EMAIL` and `ADMIN_EMAILS` never grant access. Unknown or malformed authorization state fails closed.

## Permission semantics

`admin_users.permission_mode` makes permission intent explicit:

- `role` uses the V4 allowlisted defaults for the stored role.
- `custom` uses a non-empty array containing only allowlisted permissions.
- `none` grants no delegated permission and stores an empty permission array.

The strict owner remains special. A profile receives owner authority only when it is active and has both `role = owner` and `is_owner = true`; its effective permission set is the complete allowlist independently of the stored permission array. Generic create and update operations cannot create, promote, demote, mutate, or deactivate an owner and cannot change an owner's permission mode.

Housekeeping remains a system role. It uses `permission_mode = role` and the fixed housekeeping permission set. Generic policy validation rejects `custom` and `none` for housekeeping so a client cannot expand or silently destroy its required operational access.

For `admin`, `manager`, and `read_only`, all three modes are available. `custom` with an empty list is rejected; callers must choose `none`. Every custom permission is validated by the server, and non-owners may delegate only permissions in their own effective set. Ownership transfer is never delegable.

During the local transition, profiles without `permission_mode` preserve legacy behavior:

- a valid empty permission array inherits role defaults;
- a valid non-empty permission array is treated as custom;
- a non-array or partially invalid value fails closed for non-owners;
- the strict owner retains its special authority so the audited production owner is not locked out before repair.

The schema migration backfills `role` for legacy empty arrays, owner, and housekeeping profiles, and `custom` for valid non-empty arrays. It never infers `none` from historical data. The known owner value `{}` remains visible as a constraint violation until the separate, controlled owner repair changes it to `[]`.

## Administrative password reset hierarchy

The administrative reset endpoint is distinct from a user's own Supabase Auth password-change flow. It rejects self-reset.

The strict owner may perform supported administrative resets. No non-owner may reset an owner. Between non-owners, the requester must hold `manage:users` and be strictly more privileged than the target.

Strict superiority is defined only from server-computed effective permissions:

1. both profiles must be active, known, non-owner profiles with valid permission semantics;
2. every target permission must be present in the requester's effective set;
3. the requester must have at least one effective permission the target does not have;
4. requester and target must be different identities, compared by profile ID, Auth ID, and normalized email when present.

This proper-superset relation is independent of role labels. Equivalent effective sets are peers and cannot reset each other. Incomparable sets cannot reset each other. A malformed or unknown target fails closed rather than being treated as less privileged.

## Safe administrative-user creation

The generic create operation never updates an existing Supabase Auth account and never upserts an existing `admin_users` row.

The server performs these checks before mutation:

1. validate the requested non-owner role, permission mode, permissions, email, display name, and temporary password;
2. reject an existing `admin_users` row with the same normalized email;
3. reject an existing Auth user with that email as an identity conflict;
4. create a new Auth user only when neither identity exists;
5. insert, rather than upsert, the new `admin_users` row with the new Auth ID.

If the database insert fails after Auth creation, the server deletes only the Auth user created by that invocation. It reports a database failure when compensation succeeds and a distinct manual-reconciliation error when compensation also fails. It never deletes or changes a pre-existing Auth user.

Associating an existing Auth user is a separate owner-only operation. It requires a target `admin_users` row with no Auth ID, an exact normalized-email match, an existing Auth user selected by immutable Auth ID, and no other profile already using that ID. It updates only `admin_users.auth_user_id`; it does not change passwords or Auth metadata. This operation is suitable for the later audited-owner repair after production preconditions are rechecked.

## Atomic ownership transfer

The browser sends only the target profile ID. The Netlify function authenticates the bearer session through Supabase Auth, loads the active administrative profile, verifies strict ownership, and derives the expected owner profile ID and Auth ID from that verified server state. No requester identity supplied by the browser is accepted.

The server then calls a service-role-only PostgreSQL function with the server-derived expected owner identifiers and target ID. The function:

- locks all owner candidates and the target row;
- requires exactly one coherent current owner;
- requires the current owner's profile ID and non-null Auth ID to equal the server-derived expected values;
- requires an active, non-owner target with a non-null Auth ID;
- atomically demotes the old owner to `admin` in role mode and promotes the target to strict `owner` in role mode;
- returns both profile IDs, Auth IDs, roles, and display names needed for Auth synchronization.

Execution is revoked from `public`, `anon`, and `authenticated` and granted only to `service_role`. The database checks are defense in depth and do not replace the preceding Netlify authentication and authorization.

Supabase Auth metadata cannot join the PostgreSQL transaction. After the database commits, the Netlify function synchronizes both Auth accounts while preserving unrelated metadata. Authorization continues to use `admin_users`, so an Auth metadata failure cannot create or remove authority. Any sync failure is returned explicitly with `ownershipTransferred: true` and `authSyncRequired: true`; it is never logged as complete success and the transaction is not dangerously compensated.

An owner-only, idempotent `sync_auth_metadata` action reloads the current profiles and Auth users and makes their `admin_role` and `display_name` metadata match `admin_users`. Partial failures are reported with `authSyncRequired: true` and safe account identifiers. This is the supported recovery path after a transfer-sync error.

## Database hardening

Local migrations are prepared but not applied. They add and backfill `permission_mode`, add allowlist and coherence constraints, ensure normalized-email and Auth-ID uniqueness, protect owner uniqueness, and create the transfer function.

Because production currently contains one non-array owner permission value, the permissions-array check is introduced as `NOT VALID`. PostgreSQL enforces it for new or changed rows while allowing the known legacy row to remain until the controlled repair updates `auth_user_id`, `permissions`, and `permission_mode` together. A later validation migration is prepared for execution only after the repair preconditions and post-write checks pass.

Desired invariants are:

- `permission_mode` is one of `role`, `custom`, or `none`;
- `permissions` is a JSON array;
- `custom` has at least one allowlisted value, `none` stores `[]`, and `role` stores `[]` after migration;
- role is one of `owner`, `admin`, `manager`, `read_only`, or `housekeeping`;
- `role = owner` if and only if `is_owner = true`;
- owner and housekeeping use role mode;
- at most one owner exists;
- normalized emails are unique;
- non-null Auth IDs are unique and reference `auth.users(id)` when the existing production schema permits that foreign key;
- anonymous and authenticated database roles cannot read or write `admin_users`; server access uses `service_role`.

The migration will use guarded checks and stop rather than silently coerce unexpected legacy data. Exact production catalog details and current RLS policies must be re-read before authorization to apply the migration.

## Audited production-owner repair

The later repair targets the unique masked owner already identified by the read-only audit. Logical target values are:

- `auth_user_id`: the unique Auth ID whose normalized email matches the owner;
- `permissions`: `[]`;
- `permission_mode`: `role`.

Immediately before writing, the operator must read and save the full owner row, verify that exactly one coherent active owner exists, confirm that its Auth ID is still null, confirm that permissions is still `{}`, confirm exactly one matching Auth user, and confirm that no other profile uses that Auth ID. The repair must be one conditional update matching the saved profile ID and precondition state. A zero-row update is a safe abort.

Rollback data consists of the saved row and transaction timestamp. If post-write checks fail, restoration must use a conditional update based on the just-written state; no blind overwrite is allowed.

Post-write checks re-read the owner, confirm exact Auth-ID/email correspondence, confirm `permissions = []` and `permission_mode = role`, confirm there is exactly one coherent owner, verify no duplicate Auth ID or email, exercise the server authorization path with the owner's existing session, and only then validate the pending permissions-array constraint.

## Interface behavior

Create and edit forms display a permission-mode selector. Role mode explains that role defaults are inherited and disables the matrix. Custom mode enables the matrix and requires at least one selection. None mode disables and clears the matrix. Owner rows remain non-editable. Housekeeping remains visibly fixed to its system access.

The API includes `permission_mode` in public administrative profiles and validates it independently of the interface. Existing profiles lacking the field continue to render using the transition resolver until migration.

## Testing and stopping condition

Tests first reproduce each unsafe behavior and must fail for the intended reason before implementation. Focused tests cover proper-superset reset rules, peer and self denial, custom-mode validation, none semantics, legacy preservation, owner and housekeeping invariants, Auth conflicts, compensation, transfer orchestration, explicit Auth-sync failure, resynchronization, and SQL security invariants. Existing tests then run as regression coverage.

The phase stops after local code, SQL, documentation, tests, build and static checks are complete. No Supabase operation, commit, push, deployment, or external side effect is authorized.
