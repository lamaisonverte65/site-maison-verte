-- La Maison Verte V4.15 R16 — AUD-12
-- A appliquer seulement après validation explicite et sauvegarde de la base.
-- La fonction doit être installée AVANT le déploiement du frontend R16.
-- Modifie uniquement les écritures manuelles et leur fiche immobilisation.
-- La transaction propre à chaque appel PostgREST annule LES DEUX écritures
-- en cas d'erreur, y compris lors d'un changement de traitement.

begin;

create function public.save_manual_accounting_entry_atomic(
  p_id uuid,
  p_entry jsonb,
  p_asset jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_written public.accounting_entries%rowtype;
  v_treatment text;
  v_category uuid;
  v_metadata jsonb;
begin
  if not coalesce(public.is_v4_owner(), false) then
    raise exception 'owner_required';
  end if;
  if p_entry is null or pg_catalog.jsonb_typeof(p_entry) <> 'object' then
    raise exception 'invalid_manual_accounting_entry';
  end if;

  v_treatment := coalesce(nullif(p_entry->>'treatment', ''), 'current');
  v_category := nullif(p_entry->>'category_id', '')::uuid;
  v_metadata := coalesce(p_entry->'metadata', '{}'::jsonb);
  if pg_catalog.jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'invalid_manual_accounting_metadata';
  end if;

  if v_treatment = 'fixed_asset' and (p_asset is null or pg_catalog.jsonb_typeof(p_asset) <> 'object') then
    raise exception 'missing_fixed_asset_details';
  end if;

  if p_id is null then
    insert into public.accounting_entries (
      entry_date, entry_kind, category_id, label, counterparty,
      amount_ttc, treatment, source, payment_method, notes, metadata
    ) values (
      (p_entry->>'entry_date')::date,
      p_entry->>'entry_kind',
      v_category,
      p_entry->>'label',
      nullif(p_entry->>'counterparty', ''),
      (p_entry->>'amount_ttc')::numeric,
      v_treatment,
      'manual',
      nullif(p_entry->>'payment_method', ''),
      nullif(p_entry->>'notes', ''),
      v_metadata
    ) returning * into v_written;
  else
    update public.accounting_entries set
      entry_date = (p_entry->>'entry_date')::date,
      entry_kind = p_entry->>'entry_kind',
      category_id = v_category,
      label = p_entry->>'label',
      counterparty = nullif(p_entry->>'counterparty', ''),
      amount_ttc = (p_entry->>'amount_ttc')::numeric,
      treatment = v_treatment,
      payment_method = nullif(p_entry->>'payment_method', ''),
      notes = nullif(p_entry->>'notes', ''),
      metadata = v_metadata,
      updated_at = pg_catalog.now()
    where id = p_id and source = 'manual'
    returning * into v_written;
    if not found then
      raise exception 'manual_accounting_entry_not_found';
    end if;
  end if;

  if v_treatment = 'fixed_asset' then
    insert into public.accounting_fixed_assets (
      accounting_entry_id, asset_category, in_service_date,
      acquisition_value, depreciation_method, depreciation_duration_months,
      residual_value, notes
    ) values (
      v_written.id,
      coalesce(nullif(p_asset->>'asset_category', ''), 'Autre immobilisation'),
      coalesce(nullif(p_asset->>'in_service_date', ''), v_written.entry_date::text)::date,
      (p_asset->>'acquisition_value')::numeric,
      nullif(p_asset->>'depreciation_method', ''),
      nullif(p_asset->>'depreciation_duration_months', '')::integer,
      coalesce(nullif(p_asset->>'residual_value', '')::numeric, 0),
      nullif(p_asset->>'notes', '')
    )
    on conflict (accounting_entry_id) do update set
      asset_category = excluded.asset_category,
      in_service_date = excluded.in_service_date,
      acquisition_value = excluded.acquisition_value,
      depreciation_method = excluded.depreciation_method,
      depreciation_duration_months = excluded.depreciation_duration_months,
      residual_value = excluded.residual_value,
      notes = excluded.notes,
      updated_at = pg_catalog.now();
  else
    delete from public.accounting_fixed_assets
    where accounting_entry_id = v_written.id;
  end if;

  return pg_catalog.to_jsonb(v_written);
end;
$$;

-- L'accès aux tables reste protégé par leurs politiques RLS owner_only.
-- Le contrôle propriétaire est également explicite dans la fonction.
revoke all on function public.save_manual_accounting_entry_atomic(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_manual_accounting_entry_atomic(uuid, jsonb, jsonb) to authenticated;

commit;
