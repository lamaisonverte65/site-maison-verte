# V4 Minimal Owner and Housekeeping Design

> **Corrective precedence (2026-08-28):** the housekeeping mutation,
> communication provenance, external occupation, and note-storage sections of
> this document are superseded by
> `2026-08-28-housekeeping-readonly-notes-design.md`.

## Status and scope

This specification supersedes the configurable `admin_users` design for V4. It is based on `Vision_metier_droits_interfaces_utilisateurs_V4.md` and is implemented locally only. No Supabase, Netlify, Auth, Stripe, Resend, deployment, migration execution, commit, or push is authorized.

The V4 product has exactly two active system roles:

- `owner`: unique, active, protected, and authorized for all supported administration;
- `housekeeping`: fixed operational access, with any number of accounts.

`admin`, `manager`, `read_only`, custom profiles, stored permission modes, delegated permission lists, and ownership transfer are outside the active V4 product. The existing production `read_only` row is preserved for later controlled deactivation. The historical `permissions` column is preserved but ignored by authorization.

## Identity and authorization

Supabase Auth proves identity. `admin_users` proves authority. Final authorization binds an Auth session to an active profile by `auth_user_id` and fails closed on missing, duplicate, disabled, incoherent, or unknown profiles.

Production currently has a strict owner whose `auth_user_id` is null. During the transition only, the server may use a narrowly defined owner-email fallback: the matched row must be the unique active strict owner, have a null Auth ID, and have the same normalized email as the authenticated user. The response marks this state as transitional. No housekeeping or other role may use email fallback. The fallback is removed after the controlled owner repair.

Owner authority requires `role = 'owner'`, `is_owner = true`, and `is_active = true`. Housekeeping authority requires `role = 'housekeeping'`, `is_owner = false`, and `is_active = true`. Unknown and legacy roles have no V4 authority.

## User administration

Only a strict owner can list or administer internal users. Generic operations cannot modify, deactivate, delete, or reset an owner.

Creation accepts only `email`, `display_name`, and `temporaryPassword`; the server always writes `role = 'housekeeping'`, `is_owner = false`, and `is_active = true`. Role, permissions, permission mode, owner flags, and arbitrary attributes in a creation payload are rejected. Existing Auth identities and existing profiles are rejected without mutation. If profile insertion fails, compensation deletes only the Auth identity created by that request.

Updates accept only `display_name` and `is_active`, target only housekeeping profiles, and never change role or stored permissions. Owner may reset only a housekeeping password. Self-service password changes continue through Supabase Auth. Destructive deletion remains possible only for housekeeping with strong UI confirmation; deactivation is the preferred action.

Ownership transfer actions, repositories, services, RPCs, UI controls, and Auth resynchronization dedicated only to transfer are removed from the V4 active path.

## Housekeeping read contract

The housekeeping browser never queries general administrative tables directly. It calls one authenticated Netlify endpoint. The endpoint authorizes `owner` or `housekeeping`, executes explicit-column queries using the server client, and returns only this reservation contract:

```text
id, source, startDate, endDate,
guest: { firstName, lastName, phone, email },
occupancy: { adults, children, childrenAges, babyBedNeeded },
stay: { arrivalTime, departureTime, practicalInformation },
communications: { clientMessage },
internalNotes: { ownerForHousekeeping, housekeeping: appendOnlyNotes[] }
```

No price, deposit, balance, payment state, payment record, Stripe identifier, fee, refund, payout, revenue statistic, internal tariff, technical log, or automatic-email history is selected or returned. Contract serialization uses an allowlist so extra database fields cannot cross the boundary even if a repository fixture contains them.

Client message (`message`), owner note for housekeeping (`housekeeping_notes`), and append-only `housekeeping_notes` table rows remain separate. Historical `owner_message` has insufficient provenance and is not exposed as a client communication. Historical `housekeeping_user_notes` data is preserved but is not an active write model.

## Housekeeping writes

Housekeeping is read-only for every reservation, client, external occupation, arrival/departure, communication, and administrative field. Its only write is creation of an append-only row in the separate `housekeeping_notes` table through the authenticated `housekeeping-notes` endpoint. Direct targets must exist in `booking_requests`; external targets must exist in the local `external_occupancies` registry. No note write performs an iCal or other network request.

## Frontend

The user panel shows the protected owner and housekeeping accounts. It offers one creation action, “Créer un compte ménage”, and no role selector, permission mode, permission matrix, generic role mutation, or ownership transfer.

The housekeeping branch must be selected before loading owner dashboard data. It loads only the dedicated housekeeping endpoint. The housekeeping reservation view renders customer, occupancy, arrival, departure, communication, and owner-note data as read-only text. It displays immutable housekeeping-note history and offers only a blank append-note form.

The owner Communications interface remains in place. Human messages, automatic emails, and technical logs retain distinct types; this refactor must not merge internal notes into outgoing messages.

## SQL migration strategy

The obsolete migrations `202608270002_admin_users_security.sql` and `202608270003_validate_admin_users_security.sql` are preserved under `docs/obsolete-migrations/` and removed from the executable Supabase migration path.

Phase A is additive and compatible with the audited production data:

- add read-model columns such as `departure_time` if absent;
- add normalized-email, non-null Auth-ID, and single-owner unique indexes;
- add an Auth foreign key as `NOT VALID` when absent;
- add owner coherence and owner-active checks as `NOT VALID` then validate only checks compatible with current data;
- add an active-role check as `NOT VALID`, because the production `read_only` row still exists;
- enable RLS and revoke direct `anon`/`authenticated` access to `admin_users`;
- add no `permission_mode`, permission validator, transfer RPC, drop, delete, or data rewrite.

Phase B is prepared but must not run until the production owner is linked to Auth and the real `read_only` account is audited and deactivated. It verifies every active profile has an Auth ID, validates the Auth foreign key and active-role constraint, and then adds the final active-auth invariant. It does not delete the legacy row or the historical permissions column.

## Testing and acceptance

Tests must demonstrate owner-only housekeeping administration, rejection of every arbitrary role and permission payload, owner protection, strict Auth-ID binding with the narrow owner transition, absence of financial fields from the housekeeping contract, complete reservation/client mutation refusal for housekeeping, deterministic append-only note creation, local target integrity, separation of communications and notes, and simplified frontend state helpers.

Completion requires the complete Node test suite, syntax checks for every Netlify JavaScript function, Vite production build, `git diff --check`, and manual diff inspection. No completion claim is made without fresh command output.
