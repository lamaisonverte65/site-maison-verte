# Production owner Auth-link repair runbook

This runbook is preparation for a later, separately authorized production maintenance operation. It has not been executed. It links the already audited strict owner profile to the already existing matching Supabase Auth identity. It does not change roles, permissions, passwords, metadata, or any other profile.

Never place the complete owner email, Auth UUID, service-role key, token, or password in this repository.

## Required order

1. Re-run the complete read-only `admin_users`, Auth, catalog, constraint, index, and RLS audit.
2. Save the complete owner row and matching Auth identity in an approved secure operational record.
3. Review and separately authorize additive migration `003`; do not enable the new application paths yet.
4. Review and separately authorize Phase A migration; do not assume this local file has been applied.
5. Verify owner direct access, housekeeping denial, service-role functions, the legacy calendar export, and required anonymous flows after Phase A.
6. Deploy and validate the matching code, including the service-role calendar export.
7. Execute the conditional Auth-link repair below in one transaction.
8. Run every post-write and authenticated authorization check.
9. Keep the conditional rollback window open until those checks pass.
10. Audit and deactivate the legacy `read_only` profile in a separate authorized operation.
11. Review and separately authorize Phase B only after all prerequisites pass.
12. Run one successful external synchronization before enabling the external housekeeping view.

## Read-only preconditions

Obtain these values from fresh reads and keep them outside the repository:

- `owner_profile_id`: immutable ID of the unique strict owner row;
- `owner_auth_user_id`: immutable ID of the unique matching Auth user;
- `saved_owner_row`: complete pre-write owner row and timestamps.

Abort without writing unless all conditions are true:

- exactly one row has `role = 'owner'` or `is_owner = true`;
- the row has `role = 'owner'`, `is_owner = true`, and `is_active = true`;
- its `auth_user_id` is null;
- its normalized email matches exactly one Auth user;
- no other profile uses `owner_auth_user_id`;
- no normalized-email or Auth-ID duplicate exists;
- the saved identifiers match the fresh read.

Historical `permissions` content is not an authorization source and is not changed by this repair.

## Conditional repair

Supply both IDs as protected SQL-client parameters.

```sql
begin;

select id, email, role, is_owner, is_active, auth_user_id, updated_at
from public.admin_users
where id = :owner_profile_id::uuid
for update;

with guarded_owner as (
  select au.id
  from public.admin_users au
  join auth.users u
    on u.id = :owner_auth_user_id::uuid
   and lower(u.email) = lower(au.email)
  where au.id = :owner_profile_id::uuid
    and au.role = 'owner'
    and au.is_owner is true
    and au.is_active is true
    and au.auth_user_id is null
    and not exists (
      select 1 from public.admin_users duplicate
      where duplicate.auth_user_id = :owner_auth_user_id::uuid
    )
    and 1 = (
      select count(*) from public.admin_users candidate
      where candidate.role = 'owner' or candidate.is_owner is true
    )
)
update public.admin_users au
set auth_user_id = :owner_auth_user_id::uuid,
    updated_at = now()
from guarded_owner
where au.id = guarded_owner.id
returning au.id, au.role, au.is_owner, au.is_active, au.auth_user_id, au.updated_at;

-- The UPDATE must return exactly one row. Otherwise rollback.
commit;
```

## Immediate post-write checks

- exactly one coherent active owner remains;
- its Auth ID is the expected immutable ID;
- the Auth user exists and normalized emails match;
- no duplicate normalized email or Auth ID exists;
- the real Netlify `me` path reports `authBinding = auth_user_id` and no transition requirement;
- housekeeping and legacy roles cannot use the email fallback;
- no password, Auth metadata, role, permissions, or unrelated timestamp changed.

Do not execute Phase B until the legacy active roles have also been audited and deactivated.

Before Phase B, also confirm that generic authenticated sessions cannot read or mutate owner business tables, the strict owner retains the intended direct dashboard access, `service_role` functions still operate, the deployed calendar export uses `service_role`, and required public review/visit/booking flows still work. Anonymous full-row reads of `booking_requests` are denied by Phase B and must be tested immediately afterward.

## Conditional rollback before Phase B

Use only the secure saved row and only while the owner is still in the exact just-written state.

```sql
begin;

update public.admin_users
set auth_user_id = null,
    updated_at = :saved_updated_at::timestamptz
where id = :owner_profile_id::uuid
  and auth_user_id = :owner_auth_user_id::uuid
  and role = 'owner'
  and is_owner is true
  and is_active is true
returning id, auth_user_id, updated_at;

-- The UPDATE must return exactly one row. Otherwise rollback.
commit;
```

After rollback, repeat the read-only audit. Never perform a blind overwrite.

After Phase B, do not use this owner-link rollback independently: the final active-Auth invariant intentionally rejects a null Auth ID. Any later rollback requires a separately reviewed migration rollback plan. Migration `003` data must not be dropped as rollback; disable the corresponding application path and preserve registry and note rows.
