-- Deploy the public-reviews function/frontend before this migration.
-- No data mutation. Owner authenticated policies and service-role access remain intact.
BEGIN;
REVOKE ALL ON TABLE public.guest_reviews FROM PUBLIC, anon;
DROP POLICY IF EXISTS "Allow public read published guest reviews" ON public.guest_reviews;
DROP POLICY IF EXISTS "Allow public insert guest reviews" ON public.guest_reviews;
-- Also blocks any historical permissive anonymous policy or column-level grant.
DROP POLICY IF EXISTS "v412_no_anonymous_review_access" ON public.guest_reviews;
CREATE POLICY "v412_no_anonymous_review_access" ON public.guest_reviews
AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.guest_reviews TO service_role;
COMMIT;
