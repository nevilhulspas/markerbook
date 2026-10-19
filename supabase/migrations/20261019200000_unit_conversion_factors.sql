-- Unit conversion factors the catalogue was missing, so results entered in
-- these units can be shown in the marker's catalogue unit.
-- conversion_factor: value_in_unit × factor = value_in_catalogue_unit.
-- Idempotent: rows are matched by LOINC code and inserted only when absent.

INSERT INTO public.biomarker_units (biomarker_id, unit, is_default, conversion_factor)
SELECT b.id, f.unit, false, f.factor
FROM (VALUES
  -- monovalent ions: 1 mmol/L = 1 mEq/L
  ('1963-8',  'mmol/L',  1.0),     -- Bicarbonate
  ('2075-0',  'mmol/L',  1.0),     -- Chloride
  ('2823-3',  'mmol/L',  1.0),     -- Potassium
  ('2951-2',  'mmol/L',  1.0),     -- Sodium
  ('1975-2',  'umol/L',  0.0585),  -- Bilirubin: 1 mg/dL = 17.1 umol/L
  ('2276-4',  'pmol/L',  0.445),   -- Ferritin: 1 ng/mL = 2.247 pmol/L
  ('718-7',   'mmol/L',  1.611),   -- Hemoglobin: 1 mmol/L (Fe) = 1.611 g/dL
  ('786-4',   'mmol/L',  1.611),   -- MCHC: 1 mmol/L = 1.611 g/dL
  ('28539-5', 'fmol',    16.11),   -- MCH: 1 fmol = 16.11 pg
  ('2842-3',  'mIU/L',   0.0472),  -- Prolactin: 1 ng/mL = 21.2 mIU/L (WHO 84/500)
  ('14866-8', 'ng/L',    0.106),   -- PTH (catalogue pmol/L): 1 pmol/L = 9.43 ng/L
  ('2500-7',  'umol/L',  5.587),   -- TIBC (catalogue ug/dL): 1 umol/L = 5.587 ug/dL
  ('14800-7', 'ug/dL',   0.179),   -- TIBC (catalogue umol/L)
  ('5763-8',  'umol/L',  6.54),    -- Zinc: 1 umol/L = 6.54 ug/dL
  ('30341-2', 'mm',      1.0),     -- ESR: "mm" is the mm after one hour
  ('11054-4', 'mol/mol', 1.0),     -- LDL/HDL ratio: a ratio of two molar values
  ('3052-8',  'ng/dL',   10.0),    -- Reverse T3 (catalogue ng/L, see below)
  ('3052-8',  'pmol/L',  0.651)    -- Reverse T3: 1 ng/L = 1.536 pmol/L
) AS f(loinc, unit, factor)
JOIN public.biomarkers b ON b.loinc_code = f.loinc AND b.is_custom = false
WHERE NOT EXISTS (
  SELECT 1 FROM public.biomarker_units bu
  WHERE bu.biomarker_id = b.id AND lower(bu.unit) = lower(f.unit)
);

-- Reverse T3 is a mass concentration (LOINC 3052-8), not a ratio. It has no
-- reference ranges, so only the catalogue unit changes.
UPDATE public.biomarkers
SET unit = 'ng/L'
WHERE loinc_code = '3052-8' AND is_custom = false AND unit = 'ratio';

INSERT INTO public.biomarker_units (biomarker_id, unit, is_default, conversion_factor)
SELECT b.id, 'ng/L', true, 1.0
FROM public.biomarkers b
WHERE b.loinc_code = '3052-8' AND b.is_custom = false
  AND NOT EXISTS (
    SELECT 1 FROM public.biomarker_units bu
    WHERE bu.biomarker_id = b.id AND lower(bu.unit) = 'ng/l'
  );
