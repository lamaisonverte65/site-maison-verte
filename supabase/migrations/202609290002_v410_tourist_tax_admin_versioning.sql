BEGIN;

-- B4.1 — versionnement atomique des règles de taxe de séjour.
-- L'admin ne saisit qu'une date de début. effective_to reste une donnée
-- technique dérivée : la veille de la règle suivante du même classement.
-- created_at conserve la date réelle d'enregistrement, indispensable pour
-- identifier les règles saisies tardivement sans réécrire les snapshots.

CREATE OR REPLACE FUNCTION public.admin_add_tourist_tax_rule(
  p_classification text,
  p_effective_from date,
  p_calculation_type text,
  p_base_rate_basis_points integer DEFAULT NULL,
  p_department_additional_basis_points integer DEFAULT NULL,
  p_regional_additional_basis_points integer DEFAULT NULL,
  p_base_cap_cents integer DEFAULT NULL,
  p_fixed_rate_cents integer DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.tourist_tax_rules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_start date;
  v_rule public.tourist_tax_rules;
BEGIN
  IF p_classification NOT IN ('unclassified', '1_star', '2_star', '3_star') THEN
    RAISE EXCEPTION 'Classement taxe de séjour invalide.';
  END IF;
  IF p_effective_from IS NULL THEN
    RAISE EXCEPTION 'Date de début obligatoire.';
  END IF;
  IF p_calculation_type NOT IN ('proportional', 'fixed') THEN
    RAISE EXCEPTION 'Type de règle invalide.';
  END IF;

  -- Une seule écriture concurrente par classement dans cette transaction.
  PERFORM pg_advisory_xact_lock(hashtext('tourist_tax_rules:' || p_classification));

  IF EXISTS (
    SELECT 1 FROM public.tourist_tax_rules
    WHERE classification = p_classification
      AND effective_from = p_effective_from
      AND is_active
  ) THEN
    RAISE EXCEPTION 'Une règle active existe déjà pour ce classement à cette date.';
  END IF;

  SELECT min(effective_from)
  INTO v_next_start
  FROM public.tourist_tax_rules
  WHERE classification = p_classification
    AND is_active
    AND effective_from > p_effective_from;

  -- Ferme automatiquement la règle précédente. L'utilisateur ne saisit
  -- jamais de date de fin ; elle est déduite de la version suivante.
  UPDATE public.tourist_tax_rules
  SET effective_to = p_effective_from - 1,
      updated_at = now()
  WHERE classification = p_classification
    AND is_active
    AND effective_from < p_effective_from
    AND (effective_to IS NULL OR effective_to >= p_effective_from);

  INSERT INTO public.tourist_tax_rules (
    effective_from,
    effective_to,
    classification,
    calculation_type,
    base_rate_basis_points,
    department_additional_basis_points,
    regional_additional_basis_points,
    base_cap_cents,
    fixed_rate_cents,
    notes,
    is_active
  ) VALUES (
    p_effective_from,
    CASE WHEN v_next_start IS NULL THEN NULL ELSE v_next_start - 1 END,
    p_classification,
    p_calculation_type,
    p_base_rate_basis_points,
    p_department_additional_basis_points,
    p_regional_additional_basis_points,
    p_base_cap_cents,
    p_fixed_rate_cents,
    p_notes,
    TRUE
  )
  RETURNING * INTO v_rule;

  RETURN v_rule;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_tourist_tax_rule(text,date,text,integer,integer,integer,integer,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_tourist_tax_rule(text,date,text,integer,integer,integer,integer,integer,text) TO service_role;

COMMENT ON FUNCTION public.admin_add_tourist_tax_rule(text,date,text,integer,integer,integer,integer,integer,text) IS
  'B4.1 admin : ajoute une version de règle de taxe, ferme automatiquement la précédente et conserve created_at pour détecter une saisie tardive.';

COMMIT;
