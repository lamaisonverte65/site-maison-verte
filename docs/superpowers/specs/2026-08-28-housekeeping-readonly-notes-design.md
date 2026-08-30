# V4 Housekeeping Read-Only and Append-Only Notes Design

> Production-audit correction: the authoritative version of the SQL strategy,
> external registry lifecycle, and note target is now
> `2026-08-28-production-audited-owner-housekeeping-design.md`.

## Status and precedence

This corrective specification supersedes the housekeeping mutation and communication-source sections of `2026-08-28-owner-housekeeping-minimal-design.md`. `Vision_metier_droits_interfaces_utilisateurs_V4.md` remains the business reference except for the two later decisions supplied by the owner:

- housekeeping is read-only for reservations, clients, external occupations, arrival/departure data, communications, and administration;
- housekeeping may only append a separate internal housekeeping note;
- external iCal data is occupation data unless a separate persisted source supplies real customer information.

Implementation is local only. No remote service, real secret, deployment, Supabase write, migration execution, commit, or push is authorized.

## Authorization boundary

Supabase Auth proves identity and `admin_users` proves authority. The housekeeping browser reads the dedicated housekeeping contract and creates notes through a separate authenticated notes endpoint. It never writes directly to Supabase.

Housekeeping has no mutation path for `booking_requests`, `customers`, `external_reservation_clients`, `external_occupancies`, communications, arrival/departure data, or administrative tables. Legacy endpoints must not contain role-based exceptions that allow housekeeping to update reservation fields. Owner capabilities remain unchanged.

## Persisted external occupations

The iCal feeds are upstream sources. `external_occupancies` is the canonical local persistent registry of Booking/Airbnb occupations discovered by the existing scheduled external-calendar process. It stores only stable occupation identity, dates, and current-state metadata:

```text
id
source                 booking | airbnb
external_uid
start_date
end_date
is_current
first_seen_at
last_seen_at
created_at
updated_at
unique(source, external_uid)
```

The scheduled process may upsert these rows after a successful iCal read. It never invents customer information. A housekeeping read or note write never contacts Booking, Airbnb, or an iCal URL. If an occupation has not yet been persisted, note creation fails closed until the scheduled synchronization has recorded it.

The existing `external_reservation_clients` table remains the optional local enrichment layer. It may provide manually verified guest/contact/occupancy information. An iCal title or summary is not a guest name.

## Append-only housekeeping notes

`housekeeping_notes` stores internal operational notes independently from every reservation table:

```text
id
booking_request_id       nullable FK booking_requests(id)
external_occupation_id   nullable FK external_occupancies(id)
author_admin_user_id     FK admin_users(id)
note                     non-empty, maximum 2000 characters
created_at
```

A check constraint requires exactly one target:

- a direct `booking_request_id`; or
- an `external_occupation_id`.

The external target has a simple UUID foreign key to `external_occupancies(id)`. The server resolves source and UID against the persistent local registry before inserting the note. Direct targets use a foreign key to `booking_requests`. Deletes are restricted so notes are not silently orphaned.

For V4, notes are append-only. Housekeeping and owner may read them. Housekeeping may create a note whose `author_admin_user_id` is always taken from the authenticated profile; an author ID supplied by the browser is rejected. No update or delete action exists. A correction is a new note.

RLS is enabled and all direct privileges are revoked from `anon` and `authenticated`. The service-role Netlify boundary performs explicit-column queries and inserts.

## Housekeeping read contract

The dedicated read endpoint returns allowlisted reservations only:

```text
id, source, startDate, endDate,
guest: { firstName, lastName, phone, email },
occupancy: { adults, children, childrenAges, babyBedNeeded },
stay: { arrivalTime, departureTime, practicalInformation },
communications: { clientMessage },
internalNotes: {
  ownerForHousekeeping,
  housekeeping: [{ id, note, authorAdminUserId, authorDisplayName, createdAt }]
}
```

The endpoint selects no financial fields and never performs `select("*")`. External rows come from current `external_occupancies`, enriched only by columns already persisted in `external_reservation_clients`. Missing structured arrival, departure, traveler, or practical information remains `null`; Phase A does not add speculative columns. The current external enrichment model has no qualified message provenance, so `communications.clientMessage` remains `null` for external occupations even if a legacy or future generic `message` column exists.

## Communication provenance

Historical `owner_message` values are not reliable client communications. Existing code writes that column from decision messages, refund/cancellation paths, calendar imports, and internal/admin flows. `email_logs` records delivery metadata but not the exact body. `booking_events` records operational events but cannot prove that the current `owner_message` value was sent to the client.

Therefore housekeeping receives no `ownerReply` field and `owner_message` is not selected by its endpoint. The owner-side reservation timeline also uses provenance-neutral acceptance/refusal descriptions rather than the historical column. No historical value is reclassified. A future client-communication record must persist its body, recipient, author, channel, purpose, send status, and timestamps before it can appear as an owner reply.

Client messages, verified owner-to-client communications, owner notes for housekeeping, and housekeeping notes remain distinct data categories.

## UI behavior

The housekeeping stay view renders all reservation, client, occupancy, arrival, departure, practical, and communication data as text. It contains no editable reservation control. The only form is an empty note textarea plus an “Ajouter la note ménage” action. Existing notes render as immutable entries with author and date.

The owner reservation view can consult the same notes through the authenticated notes endpoint. Financial information remains available only in owner flows and is never copied into the housekeeping contract.

## `link_existing_auth`

No product UI or current product flow calls `link_existing_auth`. The controlled owner repair is already defined as guarded SQL in `docs/operations/admin-users-owner-repair.md`. The generic API action, repository adapter method, service function, and obsolete tests are removed. The transitional `authLinkRequired` status remains until the runbook repair is separately authorized and performed.

## External enrichment architecture

Current local evidence proves only iCal UID, source, start, end, and sometimes provider summary/status. It does not prove that guest identity, contact details, traveler counts, messages, or price are present.

Future enrichment may come from one of these explicitly qualified sources:

- manually verified owner input stored in `external_reservation_clients`;
- a channel manager or PMS export/integration;
- an official Booking/Airbnb partner API or webhook, only after documentation, eligibility, authentication, contractual, and field-availability review;
- a separately designed import of platform notifications, only if provenance and data-protection requirements are met.

No API availability is assumed by this local mission. Financial enrichment, if later implemented, is owner-only and never joins the housekeeping projection.

| Information | Proven in current iCal handling | Possible official API source | Existing project source | Authentication / partnership | V4 acquisition |
|---|---|---|---|---|---|
| Source, UID, start, end | Yes; these are the fields normalized by the current parser | Not needed for the baseline occupation registry | Scheduled iCal synchronization into `external_occupancies` | Existing private iCal URL | Automatic synchronization |
| Provider title/status | Sometimes present as an event summary, but semantics are not reliable | Must be verified against official documentation | May be stored owner-side later, never as guest identity | Unknown locally | Do not expose as customer data |
| Guest name | No reliable value; summary is explicitly insufficient | Availability and access conditions are unverified | Manual verified fields in `external_reservation_clients` or linked `customers` | A documented partner/channel integration may be required | Manual until a verified integration exists |
| Phone | Not present in the fields currently consumed | Availability and access conditions are unverified | Manual verified field in `external_reservation_clients` | A documented authenticated integration may be required | Manual until verified |
| Email | Not present in the fields currently consumed | Availability and access conditions are unverified | Manual verified field in `external_reservation_clients` | A documented authenticated integration may be required | Manual until verified |
| Adults | Not present in the fields currently consumed | Availability and access conditions are unverified | Manual persisted enrichment | A documented authenticated integration may be required | Manual until verified |
| Children / ages | Not present in the fields currently consumed | Availability and access conditions are unverified | Manual `children_count` / `children_ages` enrichment | A documented authenticated integration may be required | Manual until verified |
| Client messages | Not present in the fields currently consumed | Messaging access, retention, and webhook support are unverified | No current platform-message ingestion; email logs are outbound metadata only | Likely requires a specifically authorized messaging integration if one exists | Do not import automatically in V4 |
| Arrival / special departure details | Not present in the fields currently consumed | Availability and access conditions are unverified | Manual persisted enrichment or direct-booking data | A documented authenticated integration may be required | Manual until verified |
| Price / financial split | Not present in the fields currently consumed | Availability, accounting semantics, and access conditions are unverified | No reliable external financial source in the current project | Would require a separately authorized owner-only integration if available | Owner-only; never housekeeping |
| Other welcome information | Not present unless manually enriched | Field availability is unverified | No qualified structured production column currently exists | Depends on any future documented source | Separate future design |

## SQL strategy

Phase A remains additive and adds no speculative booking or external-enrichment columns. Historical columns are preserved if they already exist. Migration `003` creates `external_occupancies` and `housekeeping_notes`, indexes their stable UUID targets, enables RLS, and revokes browser access. It contains no drop, truncate, historical rewrite, automatic action/client backfill, or delete.

Phase B remains conditional on the owner Auth repair and legacy-role deactivation. Neither migration is applied during this work.

## Acceptance

Tests must prove the read-only boundary, append-only note creation, authenticated authorship, local direct/external target validation, arbitrary UID rejection, communication separation, financial exclusion, missing external data handling, owner note visibility, removal of generic Auth linking, and preservation of the remaining security coverage. Final validation is the complete Node suite, `node --check` for every Netlify function, Vite build, `git diff --check`, and complete diff inspection.
