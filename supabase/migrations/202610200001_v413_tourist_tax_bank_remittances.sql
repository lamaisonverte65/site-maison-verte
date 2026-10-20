-- V4.13 : prélèvements bancaires Aure-Louron. Registre distinct des recettes,
-- commissions, taxes contractuelles et autres dépenses du journal comptable.
-- Migration ADDITIVE : ne modifie aucune réservation ni écriture existante.
BEGIN;

CREATE TABLE public.tourist_tax_remittances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_year integer NOT NULL CHECK (exercise_year BETWEEN 2026 AND 2100),
  exercise_month integer NOT NULL CHECK (exercise_month BETWEEN 1 AND 12),
  payment_date date NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents BETWEEN 1 AND 999999999),
  bank_reference text CHECK (bank_reference IS NULL OR length(bank_reference) <= 200),
  notes text CHECK (notes IS NULL OR length(notes) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  voided_at timestamptz,
  voided_by uuid REFERENCES auth.users(id),
  CONSTRAINT tourist_tax_remittance_void_consistency CHECK ((voided_at IS NULL) = (voided_by IS NULL))
);
CREATE INDEX tourist_tax_remittances_period_idx
  ON public.tourist_tax_remittances (exercise_year, exercise_month, payment_date DESC);
ALTER TABLE public.tourist_tax_remittances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tourist_tax_remittances FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.tourist_tax_remittances TO service_role;
COMMENT ON TABLE public.tourist_tax_remittances IS
  'Mouvements bancaires réellement débités au profit Aure-Louron. Les annulations sont historisées, aucune suppression physique.';

COMMIT;
