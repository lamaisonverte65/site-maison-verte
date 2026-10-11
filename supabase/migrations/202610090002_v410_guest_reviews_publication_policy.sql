-- V4.10 - Avis clients : publication pilotée uniquement par le statut admin.
-- Le champ consent_to_publish est conservé pour compatibilité historique,
-- mais n'intervient plus dans les policies publiques.

DROP POLICY IF EXISTS "Allow public read published guest reviews" ON public.guest_reviews;

CREATE POLICY "Allow public read published guest reviews"
ON public.guest_reviews
FOR SELECT
TO anon
USING (status = 'published');

DROP POLICY IF EXISTS "Allow public insert guest reviews" ON public.guest_reviews;

CREATE POLICY "Allow public insert guest reviews"
ON public.guest_reviews
FOR INSERT
TO anon
WITH CHECK (
  rating >= 1
  AND rating <= 5
  AND comment IS NOT NULL
  AND length(trim(comment)) >= 5
  AND status = 'pending'
);
