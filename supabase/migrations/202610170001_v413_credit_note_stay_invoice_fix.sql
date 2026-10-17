begin;

-- La Maison Verte V4.13 — B1.0
-- Un remboursement du séjour doit rechercher uniquement la facture de séjour
-- émise. Les factures ménage ou charges complémentaires liées à la même
-- réservation ne doivent pas empêcher la création de l'avoir du séjour.
-- Aucun backfill historique n'est effectué par cette migration.

create or replace function public.create_customer_credit_note_after_refund()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.customer_invoices%rowtype;
  v_invoice_count integer;
  v_total_cents bigint;
  v_tax_cents bigint;
  v_remaining_cents bigint;
  v_invoice_total_cents bigint;
  v_invoice_accommodation numeric;
  v_invoice_cleaning numeric;
  v_invoice_tax numeric;
  v_financial jsonb;
  v_kind text;
  v_manual boolean := false;
  v_accommodation_refund numeric;
  v_cleaning_refund numeric;
begin
  if not (old.status is distinct from 'succeeded' and new.status = 'succeeded' and new.refunded_amount_cents > 0) then return new; end if;

  select count(*) into v_invoice_count
  from public.customer_invoices ci
  where ci.booking_request_id = new.booking_request_id
    and ci.status = 'issued'
    and ci.invoice_kind = 'stay';
  if v_invoice_count <> 1 then return new; end if;

  select * into v_invoice
  from public.customer_invoices ci
  where ci.booking_request_id = new.booking_request_id
    and ci.status = 'issued'
    and ci.invoice_kind = 'stay'
  limit 1;

  v_total_cents := new.refunded_amount_cents;
  v_tax_cents := coalesce(new.tourist_tax_refund_cents, 0);
  if v_tax_cents > v_total_cents then return new; end if;
  v_remaining_cents := v_total_cents - v_tax_cents;
  v_invoice_total_cents := round(v_invoice.total_amount * 100)::bigint;
  v_invoice_accommodation := coalesce((v_invoice.financial_snapshot ->> 'accommodation_net')::numeric, 0);
  v_invoice_cleaning := coalesce((v_invoice.financial_snapshot ->> 'cleaning_fee')::numeric, 0);
  v_invoice_tax := coalesce((v_invoice.financial_snapshot ->> 'tourist_tax_amount')::numeric, 0);
  v_kind := case when v_total_cents = v_invoice_total_cents then 'full' else 'partial' end;

  if v_total_cents = v_invoice_total_cents then
    v_accommodation_refund := v_invoice_accommodation;
    v_cleaning_refund := v_invoice_cleaning;
    if round((v_invoice_accommodation + v_invoice_cleaning + (v_tax_cents / 100.0)) * 100)::bigint <> v_total_cents then
      v_manual := true; v_accommodation_refund := null; v_cleaning_refund := null;
    end if;
  elsif round(v_invoice_cleaning * 100)::bigint = 0 then
    v_accommodation_refund := v_remaining_cents / 100.0; v_cleaning_refund := 0;
  elsif round(v_invoice_accommodation * 100)::bigint = 0 then
    v_accommodation_refund := 0; v_cleaning_refund := v_remaining_cents / 100.0;
  else
    v_manual := true; v_accommodation_refund := null; v_cleaning_refund := null;
  end if;

  v_financial := jsonb_build_object(
    'manual_required', v_manual,
    'credit_note_kind', v_kind,
    'accommodation_refund', v_accommodation_refund,
    'cleaning_refund', v_cleaning_refund,
    'tourist_tax_refund', v_tax_cents / 100.0,
    'original_invoice_total', v_invoice.total_amount,
    'original_invoice_accommodation', v_invoice_accommodation,
    'original_invoice_cleaning', v_invoice_cleaning,
    'original_invoice_tax', v_invoice_tax
  );

  insert into public.customer_credit_notes(
    invoice_id, booking_request_id, refund_operation_id, seller_snapshot, customer_snapshot, stay_snapshot,
    financial_snapshot, refund_snapshot, currency, total_amount
  ) values (
    v_invoice.id, new.booking_request_id, new.id, v_invoice.seller_snapshot, v_invoice.customer_snapshot, v_invoice.stay_snapshot,
    v_financial,
    jsonb_build_object(
      'refund_operation_id', new.id, 'refunded_amount_cents', new.refunded_amount_cents,
      'tourist_tax_refund_cents', coalesce(new.tourist_tax_refund_cents,0), 'refund_mode', new.refund_mode,
      'effective_mode', new.effective_mode, 'policy_label', new.policy_label, 'action', new.action,
      'completed_at', new.completed_at, 'invoice_id', v_invoice.id, 'invoice_number', v_invoice.invoice_number,
      'invoice_issued_at', v_invoice.issued_at
    ),
    v_invoice.currency, new.refunded_amount_cents / 100.0
  ) on conflict (refund_operation_id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_customer_credit_note_after_refund() from public, anon, authenticated;

commit;
