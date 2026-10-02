/* LMV V4.10 B4.1 — garde d'émission des brouillons Direct historiques */
create or replace function public.admin_issue_customer_invoice(p_invoice_id uuid)
returns public.customer_invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.customer_invoices%rowtype;
  v_year integer;
  v_number integer;
  v_origin text;
  v_ready boolean;
  v_reference numeric;
  v_components numeric;
begin
  if not public.is_v4_owner() then raise exception 'owner_required'; end if;
  select * into v_invoice from public.customer_invoices where id = p_invoice_id for update;
  if not found then raise exception 'invoice_not_found'; end if;
  if v_invoice.status <> 'draft' then raise exception 'invoice_not_draft'; end if;
  if v_invoice.total_amount < 0 or v_invoice.seller_snapshot = '{}'::jsonb or v_invoice.customer_snapshot = '{}'::jsonb or v_invoice.stay_snapshot = '{}'::jsonb or v_invoice.financial_snapshot = '{}'::jsonb then
    raise exception 'invoice_snapshot_incomplete';
  end if;

  v_origin := v_invoice.financial_snapshot ->> 'draft_origin';
  if v_origin = 'legacy_direct_manual' then
    v_ready := coalesce((v_invoice.financial_snapshot ->> 'invoice_ready')::boolean, false);
    if not v_ready then raise exception 'legacy_invoice_not_ready'; end if;
    if v_invoice.financial_snapshot ->> 'accommodation_net' is null
       or v_invoice.financial_snapshot ->> 'cleaning_fee' is null
       or v_invoice.financial_snapshot ->> 'tourist_tax_amount' is null then
      raise exception 'legacy_invoice_breakdown_incomplete';
    end if;
    v_reference := (v_invoice.financial_snapshot ->> 'legacy_reference_total')::numeric;
    v_components := (v_invoice.financial_snapshot ->> 'accommodation_net')::numeric
      + (v_invoice.financial_snapshot ->> 'cleaning_fee')::numeric
      + (v_invoice.financial_snapshot ->> 'tourist_tax_amount')::numeric;
    if abs(v_components - v_reference) > 0.009 or abs(v_invoice.total_amount - v_reference) > 0.009 then
      raise exception 'legacy_invoice_total_mismatch';
    end if;
  end if;

  v_year := extract(year from timezone('Europe/Paris', now()))::integer;
  insert into public.customer_invoice_counters(invoice_year, last_number) values (v_year, 1)
  on conflict (invoice_year) do update set last_number = public.customer_invoice_counters.last_number + 1, updated_at = now()
  returning last_number into v_number;
  update public.customer_invoices set status='issued', invoice_number=format('LMV-%s-%s', v_year, lpad(v_number::text,4,'0')), issued_at=now(), updated_at=now()
  where id=p_invoice_id returning * into v_invoice;
  return v_invoice;
end;
$$;
revoke all on function public.admin_issue_customer_invoice(uuid) from public, anon;
grant execute on function public.admin_issue_customer_invoice(uuid) to authenticated;
