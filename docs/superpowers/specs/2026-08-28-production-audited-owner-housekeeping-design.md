# Production-Audited Owner and Housekeeping Design

## Status and precedence

This specification incorporates the read-only Supabase production audit completed on 2026-08-28. It supersedes conflicting SQL, external-occupation, and housekeeping-contract sections in the earlier V4 owner/housekeeping specifications. The active product model remains one strict owner and any number of fixed housekeeping accounts. Historical custom roles, `read_only`, `permission_mode`, configurable permission lists, and ownership transfer are outside the active product.

All work is local preparation only. No migration, remote write, deployment, secret use, commit, or push is authorized.

## Audited production baseline

`admin_users` contains three active profiles: one coherent owner whose `auth_user_id` is null, one linked housekeeping profile, and one linked historical `read_only` profile. Exactly one Supabase Auth identity matches the owner email. There are no duplicate normalized emails or non-null Auth identifiers. The historical `permissions` values contain two arrays and one owner object and remain preserved but ignored by application authorization.

The business tables have RLS enabled, broad grants, and several permissive policies that allow generic `authenticated` access. `booking_requests` additionally permits unrestricted anonymous reads. `service_role` has `BYPASSRLS`. Phase A must therefore establish database-enforced authenticated boundaries while preserving the transitional owner and the required public flows.

`external_calendar_actions` contains twelve valid Booking action records. It is a transformation/action journal, not a complete occupation registry. `external_reservation_clients` exists but contains no rows. It is an optional manually verified client-enrichment table, not evidence that an external occupation exists. Neither `external_occupancies` nor `housekeeping_notes` exists in production.

## Authority and identity

Supabase Auth proves identity. `admin_users` proves authority. A strict owner is an active row with `role = 'owner'` and `is_owner = true`. A housekeeping profile is active, has `role = 'housekeeping'`, and is not an owner. Stored `permissions` never alter either role's capabilities.

Phase A permits the unique audited owner to authenticate temporarily through an exact normalized-email match only while that strict owner has no Auth ID and exactly one strict owner exists. No housekeeping or legacy profile can use this fallback. Phase B removes the fallback and requires every active product profile to have a valid Auth ID.

## Phase A schema and RLS

Phase A is compatible with both the legacy deployment and the corrected deployment. It creates the normalized-email, non-null Auth-ID, and single-owner unique indexes; adds the Auth foreign key as `NOT VALID`; adds and validates the null-safe owner-coherence and owner-active constraints; and leaves the historical permissions column and every profile untouched. The final active-role constraint is deliberately deferred to Phase B because the legacy user-management function can still submit historical roles before the fixed-role code is deployed.

Phase A does not add `departure_time`, `practical_information`, or speculative external-enrichment columns. It does not change the `permissions` default.

For each existing internal business table used by the owner dashboard, Phase A adds:

- a permissive owner policy so the strict owner can continue direct authenticated access;
- a restrictive owner boundary so older permissive `authenticated` policies cannot authorize housekeeping or an unrelated Auth user.

The guarded table list includes reservation, customer, payment, communication, calendar, pricing, review, visit, Stripe, external-enrichment, external-action, and refund tables. Missing optional tables are skipped. `service_role` remains unaffected because it bypasses RLS. Anonymous review publication, review submission, visit insertion, and booking insertion are not removed. Anonymous `booking_requests` reads remain temporarily available so the legacy `export-ical` function continues to work; Phase B revokes them only after the service-role export has been deployed.

## Phase B final invariants

Phase B must abort unless all these conditions are true:

- exactly one active strict owner is linked to Auth;
- no active profile has a null role;
- every active role is `owner` or `housekeeping`;
- every active profile has a non-null Auth ID;
- the Phase A constraints exist and their pending validations succeed.

The production owner must first be linked through the guarded runbook using operator-supplied identifiers. The historical `read_only` profile must be separately audited and deactivated. Neither identifier is guessed or stored in a migration. Phase B then creates and validates the final active-role constraint, validates the Auth constraints, revokes anonymous full-row reads of `booking_requests`, and replaces the temporary owner helper with Auth-ID-only matching.

## Canonical local external-occupation registry

The iCal feeds are upstream sources. `external_occupancies` is the canonical local persistent registry of external occupations discovered from those feeds.

It stores only:

```text
id                  uuid primary key
source              booking | airbnb
external_uid        text
start_date          date
end_date            date
is_current          boolean
first_seen_at       timestamptz
last_seen_at        timestamptz
created_at          timestamptz
updated_at          timestamptz
unique(source, external_uid)
```

For each successfully fetched source, the scheduled synchronization upserts every valid event as current with one run timestamp, then marks older registry rows for that same source as non-current. A source fetch failure never retires its rows. Rows are never deleted; reappearing events become current again. Housekeeping reads and note writes never contact an iCal feed.

No migration automatically treats `external_calendar_actions` or `external_reservation_clients` rows as current occupations. After migration `003`, a successful scheduled synchronization is an operational prerequisite before enabling the external housekeeping view.

## Existing external tables

`external_calendar_actions` remains the action journal for manually applied splits, conversions, and blocks. An active applied action with created booking or block identifiers suppresses the matching raw external occupation from the housekeeping projection, preventing duplicate work beside the resulting `booking_requests` or `calendar_blocks`. It is not the parent of housekeeping notes.

`external_reservation_clients` remains optional verified enrichment. It is never populated from an iCal summary and is never used to prove occupation existence. The current zero-row state is consistent with the UI routing: unlinked events enter the period editor, while the client editor is reached only after a link already exists. This correction preserves the table and documents its dormant enrichment role; a first-class owner enrichment interface is a separate future feature.

The housekeeping endpoint selects only its existing guest/contact and owner-for-housekeeping columns. Absent structured arrival, departure, traveler, or practical fields remain `null` rather than triggering speculative schema additions.

## Append-only housekeeping notes

`housekeeping_notes` has one stable target:

```text
id
booking_request_id       nullable FK booking_requests(id)
external_occupation_id  nullable FK external_occupancies(id)
author_admin_user_id     FK admin_users(id)
note                     trimmed length 1..2000
created_at
```

Exactly one target ID must be non-null. All foreign keys use `ON UPDATE RESTRICT ON DELETE RESTRICT`. Browser roles receive no direct table privileges. `service_role` receives only `SELECT` and `INSERT` on notes, making the table append-only at the application boundary.

The browser continues to identify an external reservation as `external:<source>:<uid>`. The authenticated server resolves that pair to the current or historical local registry row, then inserts its immutable UUID. Arbitrary UIDs fail before insertion and again at the foreign key boundary. The author ID always comes from the authenticated `admin_users` profile.

## Housekeeping read contract

For direct bookings, the server selects only existing production columns: identifiers, source, dates, guest/contact fields, traveler counts, baby-bed flag, arrival time, client message, and the owner note explicitly intended for housekeeping. It does not select historical `owner_message`, financial fields, Stripe data, or `*`.

For external occupations, the server selects current registry rows and enriches them only with persisted fields that already exist in `external_reservation_clients`. Fields unavailable from qualified local storage are returned as `null`. Notes are joined by the stable registry UUID.

Historical `owner_message` remains excluded because its provenance is not reliable client communication. The production audit script's expected contract must reflect that exclusion.

## Deployment sequence and rollback boundary

The later production sequence is:

1. take and verify backups and repeat the read-only audit;
2. apply additive migration `003`, leaving the new application paths disabled;
3. apply Phase A and verify owner direct access, housekeeping denial, service-role functions, the legacy calendar export, and required anonymous flows;
4. deploy the matching Netlify/frontend code, including the service-role calendar export, and exercise public, owner, and housekeeping smoke tests;
5. execute the guarded owner Auth-link repair with protected operator parameters;
6. verify Auth-ID authorization and keep the conditional owner-link rollback available;
7. separately deactivate the audited `read_only` profile;
8. apply Phase B and verify final invariants plus anonymous booking-read denial;
9. run one authorized successful external synchronization and verify registry counts without exposing UIDs;
10. enable the external housekeeping view only after the registry check succeeds.

If Phase A authorization checks fail, revert only its newly named policies, function, constraints, indexes, and grants through a separately reviewed rollback; never rewrite business rows. Before Phase B, the owner-link runbook rollback remains conditional on the exact saved row state. Migration `003` creates new empty structures; rollback should disable the corresponding application paths rather than delete notes or registry data.

## Acceptance

Tests must prove null-safe owner constraints, Phase B preflight blocking, restrictive authenticated RLS coverage, legacy public-flow compatibility during Phase A, service-role calendar export before Phase B, anonymous booking-read denial after Phase B, absence of speculative columns, source-aware idempotent occupation synchronization, safe retirement only after successful source reads, persistent identities, transformed-event suppression, UUID note targeting, authenticated authorship, append-only grants, arbitrary UID refusal, communication separation, and financial exclusion.

Completion requires the full Node test suite, `node --check` for every Netlify JavaScript file, an isolated Vite build, `git diff --check`, and manual review of the complete diff. No remote action or commit is part of completion.
