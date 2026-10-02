/*
  LA MAISON VERTE — V4.10
  Migration A — Fondation financière et taxe de séjour

  VERSION RECONSTRUITE APRÈS AUDIT LIVE DU 28/09/2026.

  État LIVE pris en compte :
  - public.tourist_tax_rules existe déjà (V4.9) et est CONSERVÉE ;
  - stockage réglementaire existant en basis points / centimes conservé ;
  - la règle unclassified du 01/01/2026 existe déjà et n'est ni réinsérée
    ni modifiée ;
  - RLS est déjà activé sur tourist_tax_rules et n'est pas modifié ici ;
  - aucune réservation historique n'est backfillée avec des valeurs inventées ;
  - deposit_amount existant est conservé ;
  - scheduled_balance_amount et pricing_snapshot_version ne sont PAS créés.

  Cette migration doit être exécutée en une seule transaction.
*/

BEGIN;

-- ===========================================================================
-- 0. GARDE-FOUS : REFUSER D'EXÉCUTER SI LE LIVE N'EST PLUS CELUI AUDITÉ
-- ===========================================================================

DO $$
DECLARE
  missing_columns text;
  existing_unclassified_count integer;
BEGIN
  SELECT string_agg(required.column_name, ', ' ORDER BY required.column_name)
  INTO missing_columns
  FROM (
    VALUES
      ('id'),
      ('effective_from'),
      ('effective_to'),
      ('classification'),
      ('calculation_type'),
      ('base_rate_basis_points'),
      ('department_additional_basis_points'),
      ('regional_additional_basis_points'),
      ('base_cap_cents'),
      ('fixed_rate_cents'),
      ('notes'),
      ('is_active'),
      ('created_at'),
      ('updated_at')
  ) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'tourist_tax_rules'
      AND c.column_name = required.column_name
  );

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION
      'Migration V4.10 interrompue : tourist_tax_rules ne correspond plus au schéma V4.9 audité. Colonnes manquantes : %',
      missing_columns;
  END IF;

  SELECT count(*)
  INTO existing_unclassified_count
  FROM public.tourist_tax_rules
  WHERE classification = 'unclassified'
    AND effective_from = DATE '2026-01-01'
    AND calculation_type = 'proportional'
    AND base_rate_basis_points = 500
    AND department_additional_basis_points = 1000
    AND regional_additional_basis_points = 3400
    AND base_cap_cents = 460
    AND fixed_rate_cents IS NULL
    AND is_active IS TRUE;

  IF existing_unclassified_count <> 1 THEN
    RAISE EXCEPTION
      'Migration V4.10 interrompue : la règle unclassified Aure-Louron 2026 auditée est absente, dupliquée ou différente.';
  END IF;
END
$$;


-- ===========================================================================
-- 1. PARAMÈTRES COURANTS
-- ===========================================================================

ALTER TABLE public.pricing_settings
  ADD COLUMN deposit_rate numeric,
  ADD COLUMN tourist_tax_classification text;

UPDATE public.pricing_settings
SET
  deposit_rate = 0.30,
  tourist_tax_classification = 'unclassified';

ALTER TABLE public.pricing_settings
  ALTER COLUMN deposit_rate SET DEFAULT 0.30,
  ALTER COLUMN deposit_rate SET NOT NULL,
  ALTER COLUMN tourist_tax_classification SET DEFAULT 'unclassified',
  ALTER COLUMN tourist_tax_classification SET NOT NULL;

ALTER TABLE public.pricing_settings
  ADD CONSTRAINT pricing_settings_deposit_rate_check
    CHECK (deposit_rate >= 0 AND deposit_rate <= 1),
  ADD CONSTRAINT pricing_settings_tourist_tax_classification_check
    CHECK (
      tourist_tax_classification IN (
        'unclassified',
        '1_star',
        '2_star',
        '3_star'
      )
    );

COMMENT ON COLUMN public.pricing_settings.deposit_rate IS
  'Taux d''acompte courant pour les nouvelles réservations. 0.30 = 30 %.';

COMMENT ON COLUMN public.pricing_settings.tourist_tax_classification IS
  'Classement courant réel de La Maison Verte pour les nouvelles réservations. Un changement n''est pas rétroactif.';


-- ===========================================================================
-- 2. SNAPSHOT FINANCIER V4.10 DES RÉSERVATIONS
-- ===========================================================================

ALTER TABLE public.booking_requests
  ADD COLUMN deposit_rate numeric,
  ADD COLUMN deposit_basis numeric,
  ADD COLUMN contract_total numeric;

-- Aucun UPDATE de booking_requests :
-- les réservations legacy restent NULL pour ces trois nouveaux snapshots.

ALTER TABLE public.booking_requests
  ADD CONSTRAINT booking_requests_deposit_rate_v410_check
    CHECK (deposit_rate IS NULL OR (deposit_rate >= 0 AND deposit_rate <= 1)),
  ADD CONSTRAINT booking_requests_deposit_basis_v410_check
    CHECK (deposit_basis IS NULL OR deposit_basis >= 0),
  ADD CONSTRAINT booking_requests_contract_total_v410_check
    CHECK (contract_total IS NULL OR contract_total >= 0);

COMMENT ON COLUMN public.booking_requests.deposit_rate IS
  'Snapshot du taux d''acompte appliqué à cette réservation V4.10. NULL pour le legacy.';

COMMENT ON COLUMN public.booking_requests.deposit_basis IS
  'Snapshot de la base d''acompte : accommodation_net + ménage appliqué.';

COMMENT ON COLUMN public.booking_requests.contract_total IS
  'Snapshot du total contractuel : accommodation_net + ménage appliqué + tourist_tax_amount.';


-- ===========================================================================
-- 3. FAIRE COEXISTER LES BARÈMES PAR CLASSEMENT
-- ===========================================================================

-- V4.9 interdit actuellement tout chevauchement de périodes actives, même
-- entre classifications différentes. V4.10 doit autoriser les quatre
-- classifications en parallèle, tout en interdisant deux périodes actives
-- qui se chevauchent POUR UNE MÊME CLASSIFICATION.
--
-- L'opérateur "=" sur text dans une contrainte EXCLUDE GiST nécessite
-- btree_gist. L'extension est donc une dépendance explicite, pas implicite.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.tourist_tax_rules
  DROP CONSTRAINT tourist_tax_rules_no_active_overlap;

ALTER TABLE public.tourist_tax_rules
  ADD CONSTRAINT tourist_tax_rules_no_active_overlap
  EXCLUDE USING gist (
    classification WITH =,
    daterange(
      effective_from,
      CASE
        WHEN effective_to IS NULL THEN 'infinity'::date
        ELSE effective_to + 1
      END,
      '[)'
    ) WITH &&
  )
  WHERE (is_active);


-- ===========================================================================
-- 4. AJOUT DES TROIS BARÈMES FIXES 2026
-- ===========================================================================

-- La règle unclassified 2026 existante est volontairement laissée intacte.
-- L'index unique LIVE (effective_from, classification) protège également
-- contre un doublon de même classement à la même date.

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
)
VALUES
  (
    DATE '2026-01-01',
    NULL,
    '1_star',
    'fixed',
    NULL,
    NULL,
    NULL,
    NULL,
    115,
    'Aure-Louron 2026 : tarif fixe 1 étoile, 1,15 EUR par personne taxable et par nuit.',
    TRUE
  ),
  (
    DATE '2026-01-01',
    NULL,
    '2_star',
    'fixed',
    NULL,
    NULL,
    NULL,
    NULL,
    144,
    'Aure-Louron 2026 : tarif fixe 2 étoiles, 1,44 EUR par personne taxable et par nuit.',
    TRUE
  ),
  (
    DATE '2026-01-01',
    NULL,
    '3_star',
    'fixed',
    NULL,
    NULL,
    NULL,
    NULL,
    230,
    'Aure-Louron 2026 : tarif fixe 3 étoiles, 2,30 EUR par personne taxable et par nuit.',
    TRUE
  );


-- ===========================================================================
-- 5. ASSERTIONS AVANT COMMIT
-- ===========================================================================

DO $$
DECLARE
  rule_count integer;
  legacy_snapshot_count integer;
BEGIN
  SELECT count(*)
  INTO rule_count
  FROM public.tourist_tax_rules
  WHERE effective_from = DATE '2026-01-01'
    AND effective_to IS NULL
    AND is_active IS TRUE
    AND (
      (
        classification = 'unclassified'
        AND calculation_type = 'proportional'
        AND base_rate_basis_points = 500
        AND department_additional_basis_points = 1000
        AND regional_additional_basis_points = 3400
        AND base_cap_cents = 460
        AND fixed_rate_cents IS NULL
      )
      OR
      (classification = '1_star' AND calculation_type = 'fixed' AND fixed_rate_cents = 115)
      OR
      (classification = '2_star' AND calculation_type = 'fixed' AND fixed_rate_cents = 144)
      OR
      (classification = '3_star' AND calculation_type = 'fixed' AND fixed_rate_cents = 230)
    );

  IF rule_count <> 4 THEN
    RAISE EXCEPTION
      'Migration V4.10 interrompue : 4 barèmes 2026 conformes attendus, % trouvé(s).',
      rule_count;
  END IF;

  -- Puisque les colonnes viennent d'être ajoutées sans DEFAULT sur
  -- booking_requests, toute réservation existante doit encore avoir NULL
  -- dans les trois snapshots.
  SELECT count(*)
  INTO legacy_snapshot_count
  FROM public.booking_requests
  WHERE deposit_rate IS NOT NULL
     OR deposit_basis IS NOT NULL
     OR contract_total IS NOT NULL;

  IF legacy_snapshot_count <> 0 THEN
    RAISE EXCEPTION
      'Migration V4.10 interrompue : % réservation(s) historique(s) ont reçu un snapshot financier.',
      legacy_snapshot_count;
  END IF;
END
$$;

COMMIT;


-- ===========================================================================
-- 6. CONTRÔLES POST-COMMIT — LECTURE SEULE
-- ===========================================================================

SELECT
  deposit_rate,
  tourist_tax_classification
FROM public.pricing_settings;

SELECT
  classification,
  calculation_type,
  effective_from,
  effective_to,
  base_rate_basis_points,
  department_additional_basis_points,
  regional_additional_basis_points,
  base_cap_cents,
  fixed_rate_cents,
  is_active
FROM public.tourist_tax_rules
WHERE effective_from = DATE '2026-01-01'
ORDER BY classification;

SELECT
  count(*) AS legacy_rows_with_unexpected_v410_snapshot
FROM public.booking_requests
WHERE deposit_rate IS NOT NULL
   OR deposit_basis IS NOT NULL
   OR contract_total IS NOT NULL;
