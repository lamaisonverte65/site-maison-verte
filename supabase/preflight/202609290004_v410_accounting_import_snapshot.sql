-- B4.3.1C — Migration 202609290004
-- Instantanés d'import comptable par source et exercice.
-- À appliquer UNIQUEMENT après validation explicite.
--
-- Principes :
-- - un lot validé porte désormais un exercise_year explicite ;
-- - un seul lot VALIDÉ peut être actif pour une source + un exercice ;
-- - un remplacement est atomique via RPC ;
-- - l'ancien lot reste historisé avec status='replaced' ;
-- - seules les écritures rattachées à l'ancien lot sont supprimées ;
-- - les écritures manuelles et les autres sources ne sont jamais touchées.

begin;

alter table public.accounting_import_batches
  add column if not exists exercise_year integer;

alter table public.accounting_import_batches
  add column if not exists replaced_by_batch_id uuid;

alter table public.accounting_import_batches
  drop constraint if exists accounting_import_batches_exercise_year_check;

alter table public.accounting_import_batches
  add constraint accounting_import_batches_exercise_year_check
  check (exercise_year is null or exercise_year between 2000 and 2100);

alter table public.accounting_import_batches
  drop constraint if exists accounting_import_batches_replaced_by_batch_id_fkey;

alter table public.accounting_import_batches
  add constraint accounting_import_batches_replaced_by_batch_id_fkey
  foreign key (replaced_by_batch_id)
  references public.accounting_import_batches(id)
  on update restrict
  on delete restrict;

-- Le seul lot existant a été contrôlé par le préflight :
-- Booking, 114 écritures, toutes datées 2025.
update public.accounting_import_batches b
set exercise_year = x.exercise_year
from (
  select
    import_batch_id,
    min(extract(year from entry_date)::integer) as exercise_year,
    count(distinct extract(year from entry_date)::integer) as year_count
  from public.accounting_entries
  where import_batch_id is not null
  group by import_batch_id
) x
where b.id = x.import_batch_id
  and b.exercise_year is null
  and x.year_count = 1;

-- Un lot validé doit désormais être rattaché à un exercice.
alter table public.accounting_import_batches
  drop constraint if exists accounting_import_batches_validated_year_check;

alter table public.accounting_import_batches
  add constraint accounting_import_batches_validated_year_check
  check (status not in ('validated', 'replaced') or exercise_year is not null);

-- Extension du statut : on conserve l'ancien lot comme trace.
alter table public.accounting_import_batches
  drop constraint if exists accounting_import_batches_status_check;

alter table public.accounting_import_batches
  add constraint accounting_import_batches_status_check
  check (status = any (array[
    'draft'::text,
    'validated'::text,
    'replaced'::text,
    'cancelled'::text
  ]));

-- Un seul instantané validé actif par source/exercice.
create unique index if not exists accounting_import_batches_active_snapshot_unique_idx
  on public.accounting_import_batches (source, exercise_year)
  where status = 'validated';

create index if not exists accounting_import_batches_replaced_by_idx
  on public.accounting_import_batches (replaced_by_batch_id)
  where replaced_by_batch_id is not null;

create or replace function public.admin_replace_accounting_import_snapshot(
  p_new_batch_id uuid,
  p_source text,
  p_exercise_year integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_new public.accounting_import_batches%rowtype;
  v_old_id uuid;
  v_deleted_entries integer := 0;
begin
  if not public.is_v4_owner() then
    raise exception 'owner_required';
  end if;

  if p_exercise_year < 2000 or p_exercise_year > 2100 then
    raise exception 'invalid_exercise_year';
  end if;

  select *
    into v_new
  from public.accounting_import_batches
  where id = p_new_batch_id
  for update;

  if not found then
    raise exception 'new_batch_not_found';
  end if;

  if v_new.source <> p_source then
    raise exception 'source_mismatch';
  end if;

  if v_new.status <> 'draft' then
    raise exception 'new_batch_must_be_draft';
  end if;

  -- Toutes les écritures du nouveau lot doivent appartenir au même exercice.
  if exists (
    select 1
    from public.accounting_entries e
    where e.import_batch_id = p_new_batch_id
      and extract(year from e.entry_date)::integer <> p_exercise_year
  ) then
    raise exception 'new_batch_contains_other_exercise';
  end if;

  -- On refuse aussi un lot vide : validation accidentelle impossible.
  if not exists (
    select 1
    from public.accounting_entries e
    where e.import_batch_id = p_new_batch_id
  ) then
    raise exception 'new_batch_has_no_entries';
  end if;

  select id
    into v_old_id
  from public.accounting_import_batches
  where source = p_source
    and exercise_year = p_exercise_year
    and status = 'validated'
    and id <> p_new_batch_id
  for update;

  if v_old_id is not null then
    -- IMPORTANT : seules les écritures appartenant à l'ancien lot sont retirées.
    delete from public.accounting_entries
    where import_batch_id = v_old_id;

    get diagnostics v_deleted_entries = row_count;

    update public.accounting_import_batches
    set status = 'replaced',
        replaced_by_batch_id = p_new_batch_id
    where id = v_old_id;
  end if;

  update public.accounting_import_batches
  set exercise_year = p_exercise_year,
      status = 'validated',
      validated_at = now()
  where id = p_new_batch_id;

  return jsonb_build_object(
    'new_batch_id', p_new_batch_id,
    'source', p_source,
    'exercise_year', p_exercise_year,
    'replaced_batch_id', v_old_id,
    'deleted_old_entries', v_deleted_entries
  );
end;
$function$;

revoke all on function public.admin_replace_accounting_import_snapshot(uuid, text, integer)
  from public;
grant execute on function public.admin_replace_accounting_import_snapshot(uuid, text, integer)
  to authenticated;

commit;
