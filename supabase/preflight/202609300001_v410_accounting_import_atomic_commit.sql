-- B4.3.1C — Commit atomique d'un instantané d'import comptable.
-- Complète 202609290004 : les nouvelles écritures sont insérées DANS la même
-- transaction que le retrait de l'ancien instantané, ce qui évite tout conflit
-- sur (source, source_record_key).

create or replace function public.admin_commit_accounting_import_snapshot(
  p_new_batch_id uuid,
  p_source text,
  p_exercise_year integer,
  p_entries jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_new public.accounting_import_batches%rowtype;
  v_old_id uuid;
  v_deleted integer := 0;
  v_inserted integer := 0;
begin
  if not public.is_v4_owner() then raise exception 'owner_required'; end if;
  if p_source not in ('booking','airbnb','stripe','other') then raise exception 'invalid_import_source'; end if;
  if p_exercise_year < 2000 or p_exercise_year > 2100 then raise exception 'invalid_exercise_year'; end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then raise exception 'entries_required'; end if;

  select * into v_new from public.accounting_import_batches where id=p_new_batch_id for update;
  if not found then raise exception 'new_batch_not_found'; end if;
  if v_new.source <> p_source then raise exception 'source_mismatch'; end if;
  if v_new.status <> 'draft' then raise exception 'new_batch_must_be_draft'; end if;

  if exists (
    select 1 from jsonb_to_recordset(p_entries) as x(entry_date date, source text)
    where x.entry_date is null
       or extract(year from x.entry_date)::integer <> p_exercise_year
       or x.source is distinct from p_source
  ) then raise exception 'entry_scope_mismatch'; end if;

  select id into v_old_id
  from public.accounting_import_batches
  where source=p_source and exercise_year=p_exercise_year and status='validated' and id<>p_new_batch_id
  for update;

  if v_old_id is not null then
    delete from public.accounting_entries where import_batch_id=v_old_id;
    get diagnostics v_deleted = row_count;
    update public.accounting_import_batches
      set status='replaced', replaced_by_batch_id=p_new_batch_id
      where id=v_old_id;
  end if;

  insert into public.accounting_entries (
    entry_date, entry_kind, category_id, label, counterparty, amount_ttc,
    treatment, source, source_record_key, operation_group_key, external_reference,
    booking_request_id, import_batch_id, payment_method, notes, metadata
  )
  select
    x.entry_date, x.entry_kind, x.category_id, x.label, x.counterparty, x.amount_ttc,
    coalesce(x.treatment,'current'), x.source, x.source_record_key, x.operation_group_key,
    x.external_reference, x.booking_request_id, p_new_batch_id, x.payment_method, x.notes,
    coalesce(x.metadata,'{}'::jsonb)
  from jsonb_to_recordset(p_entries) as x(
    entry_date date, entry_kind text, category_id uuid, label text, counterparty text,
    amount_ttc numeric, treatment text, source text, source_record_key text,
    operation_group_key text, external_reference text, booking_request_id uuid,
    payment_method text, notes text, metadata jsonb
  );
  get diagnostics v_inserted = row_count;

  update public.accounting_import_batches
    set exercise_year=p_exercise_year, status='validated', validated_at=now()
    where id=p_new_batch_id;

  return jsonb_build_object(
    'new_batch_id',p_new_batch_id,'source',p_source,'exercise_year',p_exercise_year,
    'replaced_batch_id',v_old_id,'deleted_old_entries',v_deleted,'inserted_entries',v_inserted
  );
end;
$function$;

revoke all on function public.admin_commit_accounting_import_snapshot(uuid,text,integer,jsonb) from public;
grant execute on function public.admin_commit_accounting_import_snapshot(uuid,text,integer,jsonb) to authenticated;
