-- V4.12 - contacts supplémentaires liés aux réservations.
-- Les données saisies sont conservées sur la liaison même si la fiche client
-- nécessite une intervention manuelle (ex. conflit email/téléphone).

create table if not exists public.booking_contacts (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null references public.booking_requests(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  position smallint not null check (position between 1 and 4),
  role text not null default 'additional' check (role = 'additional'),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  address text,
  postal_code text,
  city text,
  country text,
  link_status text not null default 'pending' check (link_status in ('pending', 'linked', 'conflict', 'error')),
  link_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_request_id, position),
  unique (booking_request_id, customer_id)
);

create index if not exists booking_contacts_booking_request_idx
  on public.booking_contacts (booking_request_id);
create index if not exists booking_contacts_customer_idx
  on public.booking_contacts (customer_id)
  where customer_id is not null;

alter table public.booking_contacts enable row level security;
revoke all on table public.booking_contacts from anon;
revoke all on table public.booking_contacts from authenticated;
grant select, insert, update, delete on table public.booking_contacts to authenticated;

create policy booking_contacts_owner_only on public.booking_contacts
  for all to authenticated
  using (public.is_v4_owner())
  with check (public.is_v4_owner());

comment on table public.booking_contacts is
  'Contacts supplémentaires saisis pour une réservation, avec lien optionnel vers une fiche customers.';
comment on column public.booking_contacts.link_status is
  'pending avant rapprochement, linked si customer_id est résolu, conflict si email et téléphone désignent des clients différents.';
