/*
 LMV V4.10 — B4.3.2 A-5.1a
 Historique MANUEL du classement, indépendant de tourist_tax_rules.
 Initialisation connue : LMV louée et non classée depuis le 15/02/2024.
 Aucun barème, réservation ou snapshot n'est modifié.
*/
BEGIN;
DO $$
DECLARE n integer; c text;
BEGIN
 SELECT count(*),min(tourist_tax_classification) INTO n,c FROM public.pricing_settings;
 IF n<>1 OR c<>'unclassified' THEN RAISE EXCEPTION 'A-5.1a precondition pricing_settings failed'; END IF;
 IF to_regclass('public.tourist_tax_classification_history') IS NOT NULL THEN RAISE EXCEPTION 'history already exists'; END IF;
 IF to_regprocedure('public.is_v4_owner()') IS NULL THEN RAISE EXCEPTION 'is_v4_owner missing'; END IF;
 IF to_regprocedure('public.admin_set_tourist_tax_classification(text,date,text)') IS NOT NULL THEN RAISE EXCEPTION 'set classification RPC already exists'; END IF;
END $$;

CREATE TABLE public.tourist_tax_classification_history(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 classification text NOT NULL CHECK(classification IN('unclassified','1_star','2_star','3_star')),
 effective_from date NOT NULL CHECK(effective_from>=DATE '2024-02-15'),
 effective_to date,
 change_type text NOT NULL CHECK(change_type IN('initialization','manual_change')),
 notes text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT tourist_tax_class_history_dates_check CHECK(effective_to IS NULL OR effective_to>=effective_from)
);
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE public.tourist_tax_classification_history ADD CONSTRAINT tourist_tax_class_history_no_overlap
 EXCLUDE USING gist(daterange(effective_from,CASE WHEN effective_to IS NULL THEN 'infinity'::date ELSE effective_to+1 END,'[)') WITH &&);
CREATE UNIQUE INDEX tourist_tax_class_history_one_open_period_uidx
 ON public.tourist_tax_classification_history((effective_to IS NULL)) WHERE effective_to IS NULL;
CREATE INDEX tourist_tax_class_history_lookup_idx ON public.tourist_tax_classification_history(effective_from DESC);

ALTER TABLE public.tourist_tax_classification_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY tourist_tax_classification_history_owner_only ON public.tourist_tax_classification_history
 FOR ALL TO authenticated USING(public.is_v4_owner()) WITH CHECK(public.is_v4_owner());

CREATE OR REPLACE FUNCTION public.set_tourist_tax_class_history_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TRIGGER trg_tourist_tax_class_history_updated_at
 BEFORE UPDATE ON public.tourist_tax_classification_history
 FOR EACH ROW EXECUTE FUNCTION public.set_tourist_tax_class_history_updated_at();

INSERT INTO public.tourist_tax_classification_history(classification,effective_from,change_type,notes)
VALUES('unclassified',DATE '2024-02-15','initialization',
'Reprise historique : La Maison Verte est louée depuis le 15/02/2024 et a toujours été non classée depuis cette date.');

CREATE OR REPLACE FUNCTION public.admin_set_tourist_tax_classification(
 p_classification text,p_effective_from date,p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 cur public.tourist_tax_classification_history%ROWTYPE;
 n integer; pc text; newid uuid;
BEGIN
 IF NOT public.is_v4_owner() THEN RAISE EXCEPTION 'owner_required'; END IF;
 IF p_classification NOT IN('unclassified','1_star','2_star','3_star') THEN RAISE EXCEPTION 'invalid_classification'; END IF;
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
 UPDATE public.pricing_settings SET tourist_tax_classification=p_classification;

 RETURN jsonb_build_object('id',newid,'classification',p_classification,'effective_from',p_effective_from,
 'previous_classification',cur.classification,'previous_effective_to',p_effective_from-1);
END $$;

REVOKE ALL ON FUNCTION public.admin_set_tourist_tax_classification(text,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_tourist_tax_classification(text,date,text) TO authenticated;
COMMIT;
