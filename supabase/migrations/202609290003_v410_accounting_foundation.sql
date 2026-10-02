-- B4.3.1 — FONDATION COMPTABILITE / DECLARATIONS
-- BROUILLON A RELIRE. NE PAS EXECUTER AVANT VALIDATION DU PRE-FLIGHT LIVE.
-- Objectif : journal unique alimentable manuellement ou par import (Booking/Airbnb/Stripe),
-- dépenses, immobilisations et justificatifs. Aucun calcul fiscal n'est figé ici.
-- Etat LIVE contrôlé par le pre-flight du 29/09/2026 : booking_requests/payments/Stripe présents ;
-- aucune FK vers external_reservations n'est créée sans structure LIVE confirmée.

create table public.accounting_categories (
  id uuid primary key default gen_random_uuid(),
  entry_kind text not null check (entry_kind in ('income', 'expense')),
  code text not null,
  name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounting_categories_code_key unique (entry_kind, code)
);

create table public.accounting_import_batches (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('booking', 'airbnb', 'stripe', 'manual', 'other')),
  original_filename text,
  file_sha256 text,
  status text not null default 'draft' check (status in ('draft', 'validated', 'cancelled')),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  accepted_rows integer not null default 0 check (accepted_rows >= 0),
  rejected_rows integer not null default 0 check (rejected_rows >= 0),
  gross_total numeric(12,2),
  fees_total numeric(12,2),
  net_total numeric(12,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  constraint accounting_import_batches_file_unique unique (source, file_sha256)
);

create table public.accounting_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  entry_kind text not null check (entry_kind in ('income', 'expense')),
  category_id uuid references public.accounting_categories(id) on update restrict on delete restrict,
  label text not null,
  counterparty text,
  amount_ttc numeric(12,2) not null check (amount_ttc >= 0),
  treatment text not null default 'current' check (treatment in ('current', 'fixed_asset', 'non_deductible', 'to_review')),
  source text not null default 'manual' check (source in ('manual', 'booking', 'airbnb', 'stripe', 'other')),
  source_record_key text,
  operation_group_key text,
  external_reference text,
  booking_request_id uuid references public.booking_requests(id) on update restrict on delete set null,
  import_batch_id uuid references public.accounting_import_batches(id) on update restrict on delete set null,
  payment_method text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotence des imports : une clé source réelle ne peut être importée qu'une fois.
-- Les saisies manuelles sans source_record_key restent libres et répétables.
create unique index accounting_entries_source_record_unique_idx
  on public.accounting_entries (source, source_record_key)
  where source_record_key is not null;

-- L'exercice civil est dérivé de entry_date ; pas de seconde vérité fiscal_year stockée.
create index accounting_entries_entry_date_idx
  on public.accounting_entries (entry_date desc);
create index accounting_entries_kind_category_idx
  on public.accounting_entries (entry_kind, category_id);
create index accounting_entries_booking_request_idx
  on public.accounting_entries (booking_request_id)
  where booking_request_id is not null;
create index accounting_entries_import_batch_idx
  on public.accounting_entries (import_batch_id)
  where import_batch_id is not null;
create index accounting_entries_operation_group_idx
  on public.accounting_entries (source, operation_group_key)
  where operation_group_key is not null;

create table public.accounting_fixed_assets (
  id uuid primary key default gen_random_uuid(),
  accounting_entry_id uuid not null unique references public.accounting_entries(id) on update restrict on delete cascade,
  asset_category text not null,
  in_service_date date not null,
  acquisition_value numeric(12,2) not null check (acquisition_value >= 0),
 depreciation_method text
  check (
    depreciation_method is null
    or depreciation_method in ('straight_line')
  ),

depreciation_duration_months integer
  check (
    depreciation_duration_months is null
    or depreciation_duration_months > 0
  ),
  residual_value numeric(12,2) not null default 0 check (residual_value >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounting_fixed_assets_residual_check check (residual_value <= acquisition_value)
);

create table public.accounting_documents (
  id uuid primary key default gen_random_uuid(),
  accounting_entry_id uuid not null references public.accounting_entries(id) on update restrict on delete cascade,
  original_filename text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now()
);

-- Owner only. Aucun accès anon/housekeeping aux données comptables.
alter table public.accounting_categories enable row level security;
alter table public.accounting_import_batches enable row level security;
alter table public.accounting_entries enable row level security;
alter table public.accounting_fixed_assets enable row level security;
alter table public.accounting_documents enable row level security;

revoke all on table public.accounting_categories from anon, authenticated;
revoke all on table public.accounting_import_batches from anon, authenticated;
revoke all on table public.accounting_entries from anon, authenticated;
revoke all on table public.accounting_fixed_assets from anon, authenticated;
revoke all on table public.accounting_documents from anon, authenticated;

grant select, insert, update, delete on table public.accounting_categories to authenticated;
grant select, insert, update, delete on table public.accounting_import_batches to authenticated;
grant select, insert, update, delete on table public.accounting_entries to authenticated;
grant select, insert, update, delete on table public.accounting_fixed_assets to authenticated;
grant select, insert, update, delete on table public.accounting_documents to authenticated;

create policy accounting_categories_owner_only on public.accounting_categories
  for all to authenticated using (public.is_v4_owner()) with check (public.is_v4_owner());
create policy accounting_import_batches_owner_only on public.accounting_import_batches
  for all to authenticated using (public.is_v4_owner()) with check (public.is_v4_owner());
create policy accounting_entries_owner_only on public.accounting_entries
  for all to authenticated using (public.is_v4_owner()) with check (public.is_v4_owner());
create policy accounting_fixed_assets_owner_only on public.accounting_fixed_assets
  for all to authenticated using (public.is_v4_owner()) with check (public.is_v4_owner());
create policy accounting_documents_owner_only on public.accounting_documents
  for all to authenticated using (public.is_v4_owner()) with check (public.is_v4_owner());

-- Catégories initiales : modifiables/complétables depuis l'admin plus tard.
insert into public.accounting_categories (entry_kind, code, name, sort_order) values
  ('income', 'rental_direct', 'Location directe', 10),
  ('income', 'rental_booking', 'Location Booking', 20),
  ('income', 'rental_airbnb', 'Location Airbnb', 30),
  ('income', 'other_income', 'Autre recette', 90),
  ('expense', 'cleaning_products', 'Entretien / produits', 10),
  ('expense', 'linen', 'Linge', 20),
  ('expense', 'small_equipment', 'Petit équipement', 30),
  ('expense', 'energy', 'Énergie', 40),
  ('expense', 'water', 'Eau', 50),
  ('expense', 'insurance', 'Assurance', 60),
  ('expense', 'cfe_taxes', 'CFE / taxes', 70),
  ('expense', 'platform_fees', 'Commissions plateformes', 80),
  ('expense', 'payment_fees', 'Frais Stripe / bancaires', 90),
  ('expense', 'website_it', 'Site / informatique', 100),
  ('expense', 'advertising', 'Publicité', 110),
  ('expense', 'repairs', 'Travaux / réparations', 120),
  ('expense', 'other_expense', 'Autre dépense', 900);
