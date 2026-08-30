-- LOCAL PREPARATION ONLY. Do not run without a fresh production read-only
-- audit, a backup, a reviewed maintenance plan, and explicit authorization.
--
-- This migration is additive. It creates the canonical local persistent
-- registry of external occupations and a separate append-only note model.

create table if not exists public.external_occupancies (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_uid text not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_occupancies_source_allowed
    check (source in ('booking', 'airbnb')),
  constraint external_occupancies_period_valid
    check (end_date > start_date),
  constraint external_occupancies_source_uid_key
    unique (source, external_uid)
);

create table if not exists public.housekeeping_notes (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid,
  external_occupation_id uuid,
  author_admin_user_id uuid not null,
  note text not null,
  created_at timestamptz not null default now(),
  constraint housekeeping_notes_direct_target_fk
    foreign key (booking_request_id)
    references public.booking_requests(id)
    on update restrict on delete restrict,
  constraint housekeeping_notes_external_target_fk
    foreign key (external_occupation_id)
    references public.external_occupancies(id)
    on update restrict on delete restrict,
  constraint housekeeping_notes_author_fk
    foreign key (author_admin_user_id)
    references public.admin_users(id)
    on update restrict on delete restrict,
  constraint housekeeping_notes_exactly_one_target
    check (
      (booking_request_id is not null and external_occupation_id is null)
      or
      (booking_request_id is null and external_occupation_id is not null)
    ),
  constraint housekeeping_notes_text_valid
    check (char_length(btrim(note)) between 1 and 2000)
);

create index if not exists housekeeping_notes_booking_created_idx
  on public.housekeeping_notes (booking_request_id, created_at)
  where booking_request_id is not null;

create index if not exists housekeeping_notes_external_created_idx
  on public.housekeeping_notes (external_occupation_id, created_at)
  where external_occupation_id is not null;

create index if not exists housekeeping_notes_author_created_idx
  on public.housekeeping_notes (author_admin_user_id, created_at);

create index if not exists external_occupancies_current_dates_idx
  on public.external_occupancies (is_current, start_date, end_date);

alter table public.external_occupancies enable row level security;
alter table public.housekeeping_notes enable row level security;

revoke all on table public.external_occupancies from anon, authenticated;
revoke all on table public.housekeeping_notes from anon, authenticated;

revoke delete, truncate on table public.external_occupancies from service_role;
grant select, insert, update on table public.external_occupancies to service_role;

revoke update, delete, truncate on table public.housekeeping_notes from service_role;
grant select, insert on table public.housekeeping_notes to service_role;

comment on table public.external_occupancies is
  'Canonical local persistent Booking/Airbnb occupation registry. iCal feeds are upstream sources and summaries are not customer data.';

comment on table public.housekeeping_notes is
  'Append-only internal housekeeping notes. Never a client communication and never a reservation field.';
