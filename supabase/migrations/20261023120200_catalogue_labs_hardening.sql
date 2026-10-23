-- Shared catalogue + lab directory hardening for a multi-user instance.
-- Idempotent: safe to run more than once.
--
-- 1. biomarkers / microbiome_taxa: record which user's import or entry created
--    a row (`created_by`), so user-created catalogue rows can be audited and
--    later scoped per user. Curated rows keep NULL.
-- 2. labs / lab_tests: signed-in users may no longer read who submitted or
--    reviewed a lab or test (`submitted_by`, `reviewed_by`, `review_notes`).
--    Admin screens read through the service role and are unaffected.
-- 3. lab_tests: an approved test is only visible when its lab is approved too,
--    so tests of a lab still waiting for review never leak.

-- 1. created_by ---------------------------------------------------------------

ALTER TABLE public.biomarkers
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.microbiome_taxa
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS biomarkers_created_by_idx
  ON public.biomarkers (created_by) WHERE created_by IS NOT NULL;

COMMENT ON COLUMN public.biomarkers.created_by IS
  'User whose import or entry created this shared row (NULL for curated rows). Never copy that user''s unit or range into the row.';

COMMENT ON COLUMN public.microbiome_taxa.created_by IS
  'User whose import created this shared taxon (NULL for curated rows).';

-- 2. Column-level read access on labs / lab_tests ------------------------------
-- Table-level SELECT is replaced by SELECT on the public columns only. A query
-- for `*` or a review column from anon/authenticated is refused.

REVOKE SELECT ON public.labs FROM anon, authenticated;
GRANT SELECT (id, name, country, city, website, description, status, reviewed_at, created_at, updated_at)
  ON public.labs TO authenticated;

REVOKE SELECT ON public.lab_tests FROM anon, authenticated;
GRANT SELECT (id, lab_id, name, method, cost, currency, turnaround_days, sample_type, provider, notes, status, reviewed_at, created_at, updated_at)
  ON public.lab_tests TO authenticated;

-- 3. Approved tests of approved labs only ---------------------------------------

DROP POLICY IF EXISTS "View approved lab tests" ON public.lab_tests;
CREATE POLICY "View approved lab tests" ON public.lab_tests
  FOR SELECT TO authenticated
  USING (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.labs l
      WHERE l.id = lab_tests.lab_id AND l.status = 'approved'
    )
  );

NOTIFY pgrst, 'reload schema';
