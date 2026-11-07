-- R30 — Réservation admin, espèces et communications facultatives.
-- Pas de modification de l'historique financier ni du contrôle des acomptes V4.10.
BEGIN;
ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS admin_payment_method text NOT NULL DEFAULT 'stripe';
ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS admin_email_notifications_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.booking_requests
  DROP CONSTRAINT IF EXISTS booking_requests_admin_payment_method_check;
ALTER TABLE public.booking_requests
  ADD CONSTRAINT booking_requests_admin_payment_method_check
  CHECK (admin_payment_method IN ('stripe','cash','none','platform'));
COMMENT ON COLUMN public.booking_requests.admin_payment_method IS
  'Admin: stripe=online, cash=à encaisser manuellement, none=personnel, platform=Booking/Airbnb. Ne constitue jamais une preuve de paiement.';
COMMENT ON COLUMN public.booking_requests.admin_email_notifications_enabled IS
  'Pour les réservations admin, autorise les emails transactionnels J-2 et après-séjour. Les historiques non concernés restent actifs par défaut.';
-- Encaissement total en espèces, atomique et idempotent par réservation.
-- Interdit d'utiliser cette fonction pour des paiements Stripe ou des plateformes.
CREATE OR REPLACE FUNCTION public.record_admin_cash_payment_atomic(
  p_booking_id uuid, p_receipt_date date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_booking public.booking_requests%rowtype;
  v_category_id uuid;
  v_entry_id uuid;
  v_total numeric(12,2);
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_only';
  END IF;
  SELECT * INTO v_booking FROM public.booking_requests WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_booking.source IS DISTINCT FROM 'admin_client' OR v_booking.admin_payment_method IS DISTINCT FROM 'cash' THEN
    RAISE EXCEPTION 'cash_booking_not_found';
  END IF;
  IF v_booking.status IS DISTINCT FROM 'confirmed' OR v_booking.payment_status IS DISTINCT FROM 'cash_pending'
    OR COALESCE(v_booking.amount_paid, 0) <> 0 THEN
    RAISE EXCEPTION 'cash_booking_not_awaiting_payment';
  END IF;
  v_total := v_booking.contract_total;
  IF v_total IS NULL OR v_total <= 0 OR p_receipt_date IS NULL
    OR p_receipt_date > (pg_catalog.now() AT TIME ZONE 'Europe/Paris')::date THEN
    RAISE EXCEPTION 'cash_receipt_invalid';
  END IF;
  -- Ne jamais enregistrer des espèces sur une réservation déjà payée via Stripe.
  IF EXISTS (SELECT 1 FROM public.payments WHERE booking_request_id = p_booking_id)
    OR v_booking.stripe_payment_intent_id IS NOT NULL
    OR v_booking.stripe_checkout_session_id IS NOT NULL THEN
    RAISE EXCEPTION 'other_payment_already_linked';
  END IF;
  SELECT id INTO v_category_id FROM public.accounting_categories
    WHERE entry_kind = 'income' AND code = 'rental_direct' LIMIT 1;
  INSERT INTO public.accounting_entries (
    entry_date, entry_kind, category_id, label, counterparty, amount_ttc,
    treatment, source, source_record_key, operation_group_key,
    booking_request_id, payment_method, metadata
  ) VALUES (
    p_receipt_date, 'income', v_category_id,
    'Séjour réglé en espèces — ' || p_booking_id::text,
    pg_catalog.concat_ws(' ', v_booking.guest_first_name, v_booking.guest_last_name),
    v_total, 'current', 'manual', 'admin-cash:' || p_booking_id::text,
    'admin-cash:' || p_booking_id::text, p_booking_id, 'espèces',
    pg_catalog.jsonb_build_object('receipt_method', 'cash', 'booking_id', p_booking_id)
  ) RETURNING id INTO v_entry_id;
  UPDATE public.booking_requests SET amount_paid = v_total, payment_status = 'manual_paid',
    balance_status = 'paid', balance_paid_at = pg_catalog.now(), updated_at = pg_catalog.now()
    WHERE id = p_booking_id;
  INSERT INTO public.booking_events (booking_request_id, event_type, label, message, actor, metadata)
    VALUES (p_booking_id, 'admin_cash_payment_received', 'Espèces encaissées',
      'Total encaissé : ' || v_total::text || ' €.', 'admin',
      pg_catalog.jsonb_build_object('accounting_entry_id', v_entry_id, 'receipt_date', p_receipt_date));
  RETURN pg_catalog.jsonb_build_object('success', true, 'amount', v_total, 'accounting_entry_id', v_entry_id);
END; $$;
REVOKE ALL ON FUNCTION public.record_admin_cash_payment_atomic(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_admin_cash_payment_atomic(uuid, date) TO service_role;

COMMIT;
