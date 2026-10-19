import type { Biomarker } from '@/lib/database.types'

/**
 * Build extraction prompt with catalog context so Claude can match
 * extracted markers against known biomarkers in a single pass.
 * Parent-only biomarkers (those with children in the catalog) are excluded
 * since they are grouping containers, not directly measurable.
 */
export function buildExtractionPrompt(catalog: Biomarker[]): string {
  // Find parent IDs that have children in the catalog
  const parentIds = new Set(
    catalog.filter((b) => b.parent_id != null).map((b) => b.parent_id!)
  )

  // Exclude parent-only biomarkers (they're grouping containers, not measurable)
  const leafBiomarkers = catalog.filter((b) => !parentIds.has(b.id))

  const catalogLines = leafBiomarkers.map((b) => {
    const aliases = [b.short_name, ...b.aliases].filter(Boolean)
    const aliasPart = aliases.length > 0 ? ` (aliases: ${aliases.join(', ')})` : ''
    const variantPart = b.variant_name ? ` [variant: ${b.variant_name}]` : ''
    return `- ${b.name}${aliasPart}${variantPart} [${b.unit}]`
  })

  return `You are analyzing a blood test lab report PDF. Extract all individual biomarker test results.

## What to extract
Only extract actual lab test results — rows in a results table where a specific analyte/biomarker was measured and has a numeric result value. Each result should have its OWN dedicated row in the source report with its own name, value, and typically a unit and reference range.

## What NOT to extract — this is critical
DO NOT extract any of the following as markers:
- **Section headers or category labels**: Text like "Hematology", "Clinical Chemistry", "Hormones", "Lipid Panel", "Essential and toxic elements in blood", "Amino acids", etc. These organize results into groups — they are NOT results themselves. Even if a number appears on the same line (it belongs to the first result UNDER the header, not to the header).
- **Descriptive notes or annotations**: Text like "serum not suitable", "Hormones in EDTA plasma (serum not suitable) - z 125", method descriptions, or footnotes
- **Lab or clinic names**: "Labor Limbach", "BODIMED", etc.
- **Patient information**: Name, date of birth, gender, patient ID
- **Sample information**: Specimen type, collection date, sampling time — put these in metadata instead
- **Qualitative results**: "negative", "normal", "positive" without a numeric value
- **Reference ranges** listed without an actual patient result value
- **Column headers**: "Group Indicator", "Biological material", "Result", "Unit of measurement", "Reference area", "Method"

A key test: Does this row represent a SPECIFIC substance/analyte that was measured in the patient's sample? If not, don't extract it.

## For each actual test result, extract:
- name: The specific biomarker/analyte name (e.g., "Glucose", "Hemoglobin", "TSH"). Use the most specific name from the report, not the section it's under
- value: The numeric result value (as a number). For "<0.5" use 0.5, for ">100" use 100, for ranges like "3.5-4.5" use the midpoint
- unit: The unit of measurement. If no unit is shown (e.g., for ratios/indices), use "" (empty string)
- confidence: "high" (clearly readable), "medium" (unusual format or partially obscured), "low" (guessed)
- catalog_match: Match this marker to the closest entry from the biomarker catalog below. Use the EXACT catalog name (case-sensitive) if it matches. Set to null if there is no good match. Be generous with matching — different languages, abbreviations, and naming variations of the same test should still match.
- loinc_code: The LOINC code that best identifies THIS test given its analyte, specimen (blood/serum/plasma vs urine), and units. Use a real LOINC code you are confident in; set null if unsure. Do NOT guess.
- ref_range_low / ref_range_high: The reference (normal) range printed next to this result on the report, as numbers in the SAME unit as the value. Null if the report shows no range.

## Language handling
This lab report may be in ANY language (Dutch, German, French, Spanish, Russian, Czech, Turkish, Arabic, Chinese, Japanese, Korean, etc.).

For non-English reports:
- First, identify the language of the report
- Extract biomarker names as they appear in the original language
- For catalog_match: translate the biomarker name to English mentally, then match to the closest catalog entry
- Common non-English biomarker names:
  - Dutch: Leukocyten=WBC, Erytrocyten=RBC, Hemoglobine=Hemoglobin, Glucose (nuchter)=Glucose (Fasting), Cholesterol=Cholesterol, Triglyceriden=Triglycerides, Ijzer=Iron, Foliumzuur=Folate, Leverenzymen=Liver enzymes (category, not a marker)
  - German: Leukozyten=WBC, Erythrozyten=RBC, Blutzucker=Glucose, Eisen=Iron, Harnsaeure=Uric Acid, Schilddruese=Thyroid (category)
  - French: Leucocytes=WBC, Glycemie=Glucose, Fer=Iron, Acide urique=Uric Acid, Cholesterol total=Total Cholesterol
  - Spanish: Leucocitos=WBC, Glucosa=Glucose, Hierro=Iron, Acido urico=Uric Acid
  - Russian: Lейкоциты=WBC, Эритроциты=RBC, Глюкоза=Glucose, Железо=Iron
- For any language not listed above, use your multilingual knowledge to match biomarker names to their English equivalents in the catalog

## Matching guidelines
- "Leucocytes" or "Leukocytes" or "White Blood Cells" or "WBC" → match to the catalog entry for white blood cells
- "Erythrocytes" or "Red Blood Cells" or "RBC" → match accordingly
- "GOT (AST)" or "ASAT" → match to AST
- "GPT (ALT)" or "ALAT" → match to ALT
- "HbA1c (IFCC)" or "HbA1c HPLC" → match to HbA1c
- Dutch, German, French, Russian biomarker names should match their English catalog equivalents
- If a biomarker has a qualifier like "in urine" or "in serum", still match to the base biomarker if the catalog doesn't have the qualified version
- "Se" or "Selenium" → Selenium; "Zn" or "Zinc" → Zinc; etc.
- When a lab reports just "Bilirubin" without qualifier, match to "Bilirubin (Total)" — most common lab convention
- When a lab reports just "Testosterone" without qualifier, match to "Testosterone (Total)"
- "Direct Bilirubin" or "Bilirubin, direct" → "Bilirubin (Direct)"
- "Free Testosterone" or "Testosterone, free" → "Testosterone (Free)"

## Metadata
Also extract:
- test_date: Date the test was performed (YYYY-MM-DD format, or null)
- lab_name: Laboratory name (or null)
- sample_type: "serum", "plasma", or "unknown"

## Biomarker catalog
${catalogLines.join('\n')}
`
}

export const EXTRACTION_SCHEMA = {
  type: 'object' as const,
  properties: {
    test_date: {
      type: ['string', 'null'] as const,
      description: 'Test date in YYYY-MM-DD format',
    },
    lab_name: {
      type: ['string', 'null'] as const,
      description: 'Laboratory name',
    },
    sample_type: {
      type: 'string' as const,
      enum: ['serum', 'plasma', 'unknown'],
    },
    markers: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          name: {
            type: 'string' as const,
            description: 'Biomarker name as shown on report',
          },
          value: {
            type: 'number' as const,
            description: 'Numeric value',
          },
          unit: {
            type: 'string' as const,
            description: 'Unit of measurement (empty string if unitless)',
          },
          confidence: {
            type: 'string' as const,
            enum: ['high', 'medium', 'low'],
          },
          catalog_match: {
            type: ['string', 'null'] as const,
            description:
              'Exact name from the biomarker catalog that matches this marker, or null if no match',
          },
          loinc_code: {
            type: ['string', 'null'] as const,
            description:
              'LOINC code that best identifies this marker given its analyte, specimen, and units. Null if unsure.',
          },
          ref_range_low: {
            type: ['number', 'null'] as const,
            description:
              'Lower bound of the reference range printed on the report in the same unit as value. Null if not shown.',
          },
          ref_range_high: {
            type: ['number', 'null'] as const,
            description:
              'Upper bound of the reference range printed on the report in the same unit as value. Null if not shown.',
          },
        },
        required: [
          'name',
          'value',
          'unit',
          'confidence',
          'catalog_match',
          'loinc_code',
          'ref_range_low',
          'ref_range_high',
        ] as const,
        additionalProperties: false,
      },
    },
  },
  required: ['test_date', 'lab_name', 'sample_type', 'markers'] as const,
  additionalProperties: false,
}
