/*
 LMV V4.10 — classement 1★ à 5★ + changement de classement daté.
 - étend les classifications existantes à 4★ et 5★ ;
 - conserve l'historique du classement ;
 - le changement est immédiat par défaut côté admin, avec date non future possible ;
 - les règles fiscales restent indépendantes et versionnées par effective_from ;
 - ajoute les barèmes fixes Aure-Louron 2026 4★ et 5★.
*/
BEGIN;

ALTER TABLE public.pricing_settings
  DROP CONSTRAINT pricing_settings_tourist_tax_classification_check;
ALTER TABLE public.pricing_settings
  ADD CONSTRAINT pricing_settings_tourist_tax_classification_check
  CHECK (tourist_tax_classification IN ('unclassified','1_star','2_star','3_star','4_star','5_star'));

ALTER TABLE public.tourist_tax_rules
  DROP CONSTRAINT tourist_tax_rules_classification_check,
  DROP CONSTRAINT tourist_tax_rules_parameters_check;
ALTER TABLE public.tourist_tax_rules
  ADD CONSTRAINT tourist_tax_rules_classification_check
    CHECK (classification IN ('unclassified','1_star','2_star','3_star','4_star','5_star')),
  ADD CONSTRAINT tourist_tax_rules_parameters_check CHECK (
    (calculation_type = 'proportional'
      AND classification = 'unclassified'
      AND base_rate_basis_points IS NOT NULL AND base_rate_basis_points >= 0
      AND department_additional_basis_points IS NOT NULL AND department_additional_basis_points >= 0
      AND regional_additional_basis_points IS NOT NULL AND regional_additional_basis_points >= 0
      AND base_cap_cents IS NOT NULL AND base_cap_cents >= 0
      AND fixed_rate_cents IS NULL)
    OR
    (calculation_type = 'fixed'
      AND classification IN ('1_star','2_star','3_star','4_star','5_star')
      AND fixed_rate_cents IS NOT NULL AND fixed_rate_cents >= 0
      AND base_rate_basis_points IS NULL
      AND department_additional_basis_points IS NULL
      AND regional_additional_basis_points IS NULL
      AND base_cap_cents IS NULL)
  );

ALTER TABLE public.tourist_tax_classification_history
  DROP CONSTRAINT tourist_tax_classification_history_classification_check;
ALTER TABLE public.tourist_tax_classification_history
  ADD CONSTRAINT tourist_tax_classification_history_classification_check
  CHECK (classification IN ('unclassified','1_star','2_star','3_star','4_star','5_star'));

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
  IF p_classification NOT IN ('unclassified','1_star','2_star','3_star','4_star','5_star') THEN
    RAISE EXCEPTION 'Classement taxe de séjour invalide.';
  END IF;
  IF p_effective_from IS NULL THEN
    RAISE EXCEPTION 'Date de début obligatoire.';
  END IF;
  IF p_calculation_type NOT IN ('proportional','fixed') THEN
    RAISE EXCEPTION 'Type de règle invalide.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('tourist_tax_rules:' || p_classification));

  IF EXISTS (
    SELECT 1 FROM public.tourist_tax_rules
    WHERE classification = p_classification
      AND effective_from = p_effective_from
      AND is_active
  ) THEN
    RAISE EXCEPTION 'Une règle active existe déjà pour ce classement à cette date.';
  END IF;

  SELECT min(effective_from) INTO v_next_start
  FROM public.tourist_tax_rules
  WHERE classification = p_classification
    AND is_active
    AND effective_from > p_effective_from;

  UPDATE public.tourist_tax_rules
  SET effective_to = p_effective_from - 1,
      updated_at = now()
  WHERE classification = p_classification
    AND is_active
    AND effective_from < p_effective_from
    AND (effective_to IS NULL OR effective_to >= p_effective_from);

  INSERT INTO public.tourist_tax_rules (
    effective_from,effective_to,classification,calculation_type,
    base_rate_basis_points,department_additional_basis_points,
    regional_additional_basis_points,base_cap_cents,fixed_rate_cents,notes,is_active
  ) VALUES (
    p_effective_from,
    CASE WHEN v_next_start IS NULL THEN NULL ELSE v_next_start - 1 END,
    p_classification,p_calculation_type,
    p_base_rate_basis_points,p_department_additional_basis_points,
    p_regional_additional_basis_points,p_base_cap_cents,p_fixed_rate_cents,p_notes,TRUE
  ) RETURNING * INTO v_rule;

  RETURN v_rule;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_tourist_tax_rule(text,date,text,integer,integer,integer,integer,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_tourist_tax_rule(text,date,text,integer,integer,integer,integer,integer,text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_set_tourist_tax_classification(
 p_classification text,p_effective_from date,p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 cur public.tourist_tax_classification_history%ROWTYPE;
 n integer; pc text; newid uuid;
BEGIN
 IF p_classification NOT IN('unclassified','1_star','2_star','3_star','4_star','5_star') THEN RAISE EXCEPTION 'invalid_classification'; END IF;
 IF p_effective_from IS NULL THEN RAISE EXCEPTION 'effective_from_required'; END IF;
 IF p_effective_from>current_date THEN RAISE EXCEPTION 'future_classification_not_allowed'; END IF;

 SELECT * INTO cur FROM public.tourist_tax_classification_history WHERE effective_to IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'open_classification_period_not_found'; END IF;
 IF p_effective_from<=cur.effective_from THEN RAISE EXCEPTION 'historical_correction_required'; END IF;
 IF p_classification=cur.classification THEN RAISE EXCEPTION 'classification_unchanged'; END IF;

 SELECT count(*),min(tourist_tax_classification) INTO n,pc FROM public.pricing_settings;
 IF n<>1 THEN RAISE EXCEPTION 'pricing_settings_single_row_required'; END IF;
 IF pc IS DISTINCT FROM cur.classification THEN RAISE EXCEPTION 'classification_authorities_out_of_sync'; END IF;

 UPDATE public.tourist_tax_classification_history SET effective_to=p_effective_from-1 WHERE id=cur.id;
 INSERT INTO public.tourist_tax_classification_history(classification,effective_from,change_type,notes)
 VALUES(p_classification,p_effective_from,'manual_change',NULLIF(btrim(p_notes),''))
 RETURNING id INTO newid;
 UPDATE public.pricing_settings
 SET tourist_tax_classification=p_classification,
     updated_at=now();

 RETURN jsonb_build_object('id',newid,'classification',p_classification,'effective_from',p_effective_from,
 'previous_classification',cur.classification,'previous_effective_to',p_effective_from-1);
END $$;

REVOKE ALL ON FUNCTION public.admin_set_tourist_tax_classification(text,date,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_tourist_tax_classification(text,date,text) TO service_role;

INSERT INTO public.tourist_tax_rules (
  effective_from,effective_to,classification,calculation_type,
  base_rate_basis_points,department_additional_basis_points,
  regional_additional_basis_points,base_cap_cents,fixed_rate_cents,notes,is_active
)
SELECT DATE '2026-01-01',NULL,'4_star','fixed',NULL,NULL,NULL,NULL,360,
  'Aure-Louron 2026 : tarif fixe 4 étoiles, 3,60 EUR par personne taxable et par nuit.',TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM public.tourist_tax_rules
  WHERE effective_from=DATE '2026-01-01' AND classification='4_star' AND is_active
);

INSERT INTO public.tourist_tax_rules (
  effective_from,effective_to,classification,calculation_type,
  base_rate_basis_points,department_additional_basis_points,
  regional_additional_basis_points,base_cap_cents,fixed_rate_cents,notes,is_active
)
SELECT DATE '2026-01-01',NULL,'5_star','fixed',NULL,NULL,NULL,NULL,475,
  'Aure-Louron 2026 : tarif fixe 5 étoiles, 4,75 EUR par personne taxable et par nuit.',TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM public.tourist_tax_rules
  WHERE effective_from=DATE '2026-01-01' AND classification='5_star' AND is_active
);

COMMIT;
