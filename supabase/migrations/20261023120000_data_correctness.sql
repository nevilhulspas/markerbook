-- Data-correctness fixes (2026-10-23 review).
-- Idempotent: every statement can run again without changing anything.
--
-- 1. test_results.qualifier: '<' / '<=' / '>' / '>=' for results such as
--    "<0.5" or ">100", which were stored as a plain 0.5 / 100.
-- 2. replace_blood_test_results(): the edit-test save in ONE transaction.
--    It keeps unchanged results (and their interpretations), updates changed
--    ones in place and deletes only the removed ones. The old save deleted
--    every result and inserted them again, in separate requests: a failed
--    insert left the test empty, and every interpretation was lost.
-- 3. Catalogue rows (the same block is at the end of supabase/seed.sql):
--    - Methylmalonate 0–0.4 nmol/L → 0–400 nmol/L (AI range in µmol/L).
--    - Ceruloplasmin 20–40 mg/L → 200–400 mg/L (AI range in mg/dL).
--    - RDW-CV (LOINC 788-0, where the results live) gets the range, aliases
--      and panel of the archived 'RDW' row.
--    - Bilirubin (LOINC 1975-2) holds the total-bilirubin results but was a
--      group container with no range, because 'Bilirubin (Total)' is
--      archived. It becomes a normal marker with the total range; 'Bilirubin
--      (Direct)' is no longer its child.

-- ---------------------------------------------------------------------------
-- 1. qualifier column
-- ---------------------------------------------------------------------------

ALTER TABLE public.test_results ADD COLUMN IF NOT EXISTS qualifier text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'test_results_qualifier_check'
      AND conrelid = 'public.test_results'::regclass
  ) THEN
    ALTER TABLE public.test_results
      ADD CONSTRAINT test_results_qualifier_check
      CHECK (qualifier IS NULL OR qualifier IN ('<', '<=', '>', '>='));
  END IF;
END $$;

COMMENT ON COLUMN public.test_results.qualifier IS
  'Comparison sign the lab printed before the value ("<0.5" → value 0.5, qualifier "<"). NULL for a plain value.';

-- ---------------------------------------------------------------------------
-- 2. replace_blood_test_results
-- ---------------------------------------------------------------------------

-- p_results: [{ "biomarker_id": uuid, "value": number, "qualifier": text|null, "unit": text }]
-- Called by the server with the service-role key, after the caller checked
-- ownership through RLS; p_user_id is checked again here.
CREATE OR REPLACE FUNCTION public.replace_blood_test_results(
  p_test_id uuid,
  p_user_id uuid,
  p_name text,
  p_test_date date,
  p_sample_type text,
  p_notes text,
  p_results jsonb
) RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
AS $$
declare
  v_count integer;
begin
  update public.blood_tests
     set name = p_name,
         test_date = p_test_date,
         sample_type = p_sample_type,
         notes = p_notes,
         updated_at = now()
   where id = p_test_id
     and user_id = p_user_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'test_not_found' using errcode = 'P0002';
  end if;

  -- Removed results (their interpretations go with them by cascade).
  delete from public.test_results tr
   where tr.blood_test_id = p_test_id
     and not exists (
       select 1
         from jsonb_to_recordset(coalesce(p_results, '[]'::jsonb))
              as r(biomarker_id uuid, value numeric, qualifier text, unit text)
        where r.biomarker_id = tr.biomarker_id
     );

  -- A changed value makes the marker's interpretation stale.
  delete from public.interpretations i
   using public.test_results tr,
         jsonb_to_recordset(coalesce(p_results, '[]'::jsonb))
           as r(biomarker_id uuid, value numeric, qualifier text, unit text)
   where i.test_result_id = tr.id
     and tr.blood_test_id = p_test_id
     and tr.biomarker_id = r.biomarker_id
     and (tr.value, tr.unit, tr.qualifier) is distinct from (r.value, r.unit, r.qualifier);

  -- New and changed results; an unchanged row is not written at all.
  insert into public.test_results (blood_test_id, biomarker_id, value, qualifier, unit)
  select p_test_id, r.biomarker_id, r.value, r.qualifier, r.unit
    from jsonb_to_recordset(coalesce(p_results, '[]'::jsonb))
         as r(biomarker_id uuid, value numeric, qualifier text, unit text)
  on conflict (blood_test_id, biomarker_id) do update
     set value = excluded.value,
         qualifier = excluded.qualifier,
         unit = excluded.unit
   where (public.test_results.value, public.test_results.unit, public.test_results.qualifier)
         is distinct from (excluded.value, excluded.unit, excluded.qualifier);
end;
$$;

REVOKE ALL ON FUNCTION public.replace_blood_test_results(uuid, uuid, text, date, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_blood_test_results(uuid, uuid, text, date, text, text, jsonb)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Catalogue rows
-- ---------------------------------------------------------------------------

-- Methylmalonate: 0–0.4 is the µmol/L range written as nmol/L.
UPDATE public.biomarkers
SET ref_range_low = 0, ref_range_high = 400
WHERE id = '84aefa69-de54-40f5-9e0a-710897718eac'
  AND unit = 'nmol/L' AND ref_range_high = 0.4;

-- Ceruloplasmin: 20–40 is the mg/dL range written as mg/L.
UPDATE public.biomarkers
SET ref_range_low = 200, ref_range_high = 400
WHERE id = '9dbf2d82-0324-4105-852b-321feb993621'
  AND unit = 'mg/L' AND ref_range_low = 20 AND ref_range_high = 40;

-- RDW-CV takes over from the archived RDW row (same LOINC 788-0).
UPDATE public.biomarkers
SET ref_range_low = 11.5,
    ref_range_high = 14.5,
    short_name = COALESCE(short_name, 'RDW'),
    description = COALESCE(description, 'Red Cell Distribution Width - measures variation in red blood cell size'),
    panel_id = COALESCE(panel_id, '0edf3662-1993-43e4-92f8-ef173712f02f'),
    aliases = ARRAY(
      SELECT DISTINCT a FROM unnest(aliases || ARRAY['RDW', 'Red Cell Distribution Width']) AS a
    )
WHERE id = '9caf0469-359a-40f7-aa44-b08eb586cfd6'
  AND (ref_range_low IS NULL AND ref_range_high IS NULL
    OR NOT aliases @> ARRAY['RDW', 'Red Cell Distribution Width']);

INSERT INTO public.reference_ranges (biomarker_id, unit, sex, range_low, range_high, source, range_type)
SELECT '9caf0469-359a-40f7-aa44-b08eb586cfd6', '%', 'general', 11.5, 14.5, 'seeded', 'normal'
WHERE EXISTS (SELECT 1 FROM public.biomarkers WHERE id = '9caf0469-359a-40f7-aa44-b08eb586cfd6')
  AND NOT EXISTS (
    SELECT 1 FROM public.reference_ranges
    WHERE biomarker_id = '9caf0469-359a-40f7-aa44-b08eb586cfd6' AND range_type = 'normal'
  );

-- Bilirubin: from group container to the total-bilirubin marker.
UPDATE public.biomarkers
SET parent_id = NULL, variant_name = NULL
WHERE parent_id = 'aa1ecabb-8354-4f49-8665-e546c76a0c30'
  AND id IN ('666352d2-5792-46d9-b952-708d653133a9', 'e8941ddf-d7fb-4401-9bcc-852ebfeda0df');

UPDATE public.biomarkers
SET ref_range_low = 0.1,
    ref_range_high = 1.2,
    description = 'Total bilirubin: breakdown product of hemoglobin, elevated in liver disease and hemolysis',
    aliases = ARRAY(
      SELECT DISTINCT a FROM unnest(
        aliases || ARRAY['total bilirubin', 'Bilirubin, total', 'bilirubin total', 'TBIL', 'Bilirubin (Total)']
      ) AS a
    )
WHERE id = 'aa1ecabb-8354-4f49-8665-e546c76a0c30'
  AND ref_range_low IS NULL AND ref_range_high IS NULL;

INSERT INTO public.reference_ranges (biomarker_id, unit, sex, range_low, range_high, source, range_type)
SELECT 'aa1ecabb-8354-4f49-8665-e546c76a0c30', 'mg/dL', 'general', 0.1, 1.2, 'seeded', 'normal'
WHERE EXISTS (SELECT 1 FROM public.biomarkers WHERE id = 'aa1ecabb-8354-4f49-8665-e546c76a0c30')
  AND NOT EXISTS (
    SELECT 1 FROM public.reference_ranges
    WHERE biomarker_id = 'aa1ecabb-8354-4f49-8665-e546c76a0c30' AND range_type = 'normal'
  );
