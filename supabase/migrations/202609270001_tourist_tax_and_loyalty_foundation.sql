-- V4.9 foundation: dated tourist-tax rules, immutable booking calculation snapshot,
-- and server-side loyalty promotion configuration.
-- This migration is additive. It does not change the live booking calculation yet.

create table if not exists public.tourist_tax_rules (
  id uuid primary key default gen_random_uuid(),
  effective_from date not null,
  effective_to date,
  classification text not null,
  calculation_type text not null,
  base_rate_basis_points integer,
  department_additional_basis_points integer,
  regional_additional_basis_points integer,
  base_cap_cents integer,
  fixed_rate_cents integer,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tourist_tax_rules_dates_check check (effective_to is null or effective_to >= effective_from),
  constraint tourist_tax_rules_classification_check check (classification in ('unclassified', '1_star', '2_star', '3_star')),
  constraint tourist_tax_rules_type_check check (calculation_type in ('proportional', 'fixed')),
  constraint tourist_tax_rules_parameters_check check (
    (calculation_type = 'proportional'
      and classification = 'unclassified'
      and base_rate_basis_points is not null and base_rate_basis_points >= 0
      and department_additional_basis_points is not null and department_additional_basis_points >= 0
      and regional_additional_basis_points is not null and regional_additional_basis_points >= 0
      and base_cap_cents is not null and base_cap_cents >= 0
      and fixed_rate_cents is null)
    or
    (calculation_type = 'fixed'
      and classification in ('1_star', '2_star', '3_star')
      and fixed_rate_cents is not null and fixed_rate_cents >= 0
      and base_rate_basis_points is null
      and department_additional_basis_points is null
      and regional_additional_basis_points is null
      and base_cap_cents is null)
  )
);

create unique index if not exists tourist_tax_rules_effective_classification_uidx
  on public.tourist_tax_rules (effective_from, classification);
create index if not exists tourist_tax_rules_active_dates_idx
  on public.tourist_tax_rules (effective_from, effective_to)
  where is_active is true;

-- Exactly one active tourist-tax rule may apply to any given night.
-- daterange uses an exclusive upper bound, hence effective_to + 1 day.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tourist_tax_rules_no_active_overlap'
      and conrelid = 'public.tourist_tax_rules'::regclass
  ) then
    alter table public.tourist_tax_rules
      add constraint tourist_tax_rules_no_active_overlap
      exclude using gist (
        daterange(
          effective_from,
          case
            when effective_to is null then 'infinity'::date
            else effective_to + 1
          end,
          '[)'
        ) with &&
      )
      where (is_active);
  end if;
end;
$$;

alter table public.tourist_tax_rules enable row level security;
revoke all on table public.tourist_tax_rules from public, anon, authenticated;
grant select, insert, update, delete on table public.tourist_tax_rules to service_role;

comment on table public.tourist_tax_rules is
  'V4.9 dated regulatory tourist-tax rules. Historical rules are retained; application code must not overwrite a rule already snapshotted by a booking.';

insert into public.tourist_tax_rules (
  effective_from, effective_to, classification, calculation_type,
  base_rate_basis_points, department_additional_basis_points,
  regional_additional_basis_points, base_cap_cents, notes
)
select
  date '2026-01-01', date '2026-12-31', 'unclassified', 'proportional',
  500, 1000, 3400, 460,
  'Aure-Louron 2026: 5 %, additionnelle departementale 10 %, additionnelle regionale 34 %, plafond de base 4,60 EUR.'
where not exists (
  select 1 from public.tourist_tax_rules
  where effective_from = date '2026-01-01' and classification = 'unclassified'
);

create table if not exists public.promotion_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  discount_basis_points integer not null,
  applies_to text not null default 'accommodation',
  effective_from date,
  effective_to date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotion_rules_code_check check (code = upper(code) and length(code) between 1 and 40),
  constraint promotion_rules_discount_check check (discount_basis_points between 0 and 10000),
  constraint promotion_rules_scope_check check (applies_to = 'accommodation'),
  constraint promotion_rules_dates_check check (effective_to is null or effective_from is null or effective_to >= effective_from)
);
create unique index if not exists promotion_rules_code_uidx on public.promotion_rules (code);
alter table public.promotion_rules enable row level security;
revoke all on table public.promotion_rules from public, anon, authenticated;
grant select, insert, update, delete on table public.promotion_rules to service_role;

insert into public.promotion_rules (code, discount_basis_points, applies_to, effective_from, effective_to, is_active)
values ('CLIENTFIDELE', 1000, 'accommodation', date '2026-09-27', null, true)
on conflict (code) do nothing;

comment on table public.promotion_rules is
  'Server-side promotion configuration. CLIENTFIDELE is 10 percent off accommodation only; cleaning and tourist tax are excluded.';

alter table public.booking_requests
  add column if not exists accommodation_gross numeric,
  add column if not exists promotion_code text,
  add column if not exists promotion_discount_rate numeric,
  add column if not exists promotion_discount_amount numeric,
  add column if not exists accommodation_net numeric,
  add column if not exists tourist_tax_amount numeric,
  add column if not exists tourist_tax_collected numeric not null default 0,
  add column if not exists tourist_tax_refunded numeric not null default 0,
  add column if not exists tourist_tax_collector text,
  add column if not exists tourist_tax_snapshot jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'booking_requests_v49_money_nonnegative'
      and conrelid = 'public.booking_requests'::regclass
  ) then
    alter table public.booking_requests
      add constraint booking_requests_v49_money_nonnegative check (
        (accommodation_gross is null or accommodation_gross >= 0)
        and (promotion_discount_rate is null or promotion_discount_rate between 0 and 1)
        and (promotion_discount_amount is null or promotion_discount_amount >= 0)
        and (accommodation_net is null or accommodation_net >= 0)
        and (tourist_tax_amount is null or tourist_tax_amount >= 0)
        and tourist_tax_collected >= 0
        and tourist_tax_refunded >= 0
        and tourist_tax_refunded <= tourist_tax_collected
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'booking_requests_tourist_tax_collector_check'
      and conrelid = 'public.booking_requests'::regclass
  ) then
    alter table public.booking_requests
      add constraint booking_requests_tourist_tax_collector_check
      check (tourist_tax_collector is null or tourist_tax_collector in ('la_maison_verte', 'platform'));
  end if;
end;
$$;

comment on column public.booking_requests.accommodation_gross is 'Accommodation amount before promotion; excludes cleaning and tourist tax.';
comment on column public.booking_requests.promotion_code is 'Promotion code snapshotted on the booking, when applicable.';
comment on column public.booking_requests.promotion_discount_rate is 'Promotion rate snapshotted as decimal fraction, e.g. 0.10.';
comment on column public.booking_requests.promotion_discount_amount is 'Accommodation-only promotion amount snapshotted on the booking.';
comment on column public.booking_requests.accommodation_net is 'Accommodation amount after promotion; excludes cleaning and tourist tax.';
comment on column public.booking_requests.tourist_tax_amount is 'Tourist tax calculated and contractually due for this booking.';
comment on column public.booking_requests.tourist_tax_collected is 'Tourist tax actually collected from the guest.';
comment on column public.booking_requests.tourist_tax_refunded is 'Tourist tax actually refunded to the guest.';
comment on column public.booking_requests.tourist_tax_collector is 'Entity responsible for collection: la_maison_verte or platform.';
comment on column public.booking_requests.tourist_tax_snapshot is 'Immutable calculation snapshot: rule ids/parameters, occupants, taxable/exempt people, nightly bases, rounding details and final amount.';
