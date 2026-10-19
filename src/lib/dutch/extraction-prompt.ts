import type { Biomarker } from '@/lib/database.types'

/**
 * Build DUTCH-specific extraction prompt with catalog context so Claude can
 * match extracted markers against known DUTCH biomarkers in a single pass.
 *
 * Includes all dutch_* category biomarkers — parents are also measurable
 * on the DUTCH test (Estrone, Estradiol, Testosterone have real values).
 */
export function buildDutchExtractionPrompt(catalog: Biomarker[]): string {
  // Filter to DUTCH categories only
  const dutchCatalog = catalog.filter((b) => b.category.startsWith('dutch_'))

  const catalogLines = dutchCatalog.map((b) => {
    const aliases = [b.short_name, ...b.aliases].filter(Boolean)
    const aliasPart = aliases.length > 0 ? ` (aliases: ${aliases.join(', ')})` : ''
    const variantPart = b.variant_name ? ` [variant: ${b.variant_name}]` : ''
    return `- ${b.name}${aliasPart}${variantPart} [${b.unit}]`
  })

  return `You are analyzing a DUTCH (Dried Urine Test for Comprehensive Hormones) test report PDF. Extract all individual hormone metabolite marker results.

## DUTCH PDF page structure — what to focus on
- **PRIMARY extraction source**: Pages with LIST or TABLE data — sex hormone metabolite lists, adrenal hormone metabolite lists, and Organic Acid Test (OAT) markers. These have clear marker names, numeric values, and units.
- **SKIP gauge dial summary pages**: These are graphical summaries with dial gauges — they are imprecise visual representations, not source data.
- **SKIP pathway reference diagrams**: These are static metabolic pathway diagrams, not patient-specific data.
- **SKIP "About Your Results" pages**: These contain interpretive text only, not measurable values.

## What to extract
Extract actual lab test results where a specific hormone metabolite was measured and has a numeric result value. Each result should have its own name, value, unit, and typically a reference range.

## Timepoint handling — CRITICAL
For **Free Cortisol (Urine)** and **Free Cortisone (Urine)**, the DUTCH report shows 4 separate values collected at different times of day. Extract ALL 4 values as separate marker entries with timepoint labels:
- "waking" — first morning collection
- "morning" — second collection (~2 hours after waking)
- "afternoon" — third collection (around dinner time)
- "night" — fourth collection (bedtime)

For all other markers that do NOT have multiple timepoint values, set timepoint to null.

## What NOT to extract — this is critical
DO NOT extract any of the following:
- **Computed ratios or derived calculations** — we compute these ourselves. Specifically skip:
  - 2-OH/4-OH ratio
  - 2-OH/16-OH ratio
  - Methylation activity / COMT ratio
  - 5a-Reductase preference / 5a/5b ratio
  - Cortisol clearance rate
  - 24-hour totals (we sum timepoint values ourselves)
  - Any ratio, percentage, or calculated balance score
- **Section headers or category labels**: "Estrogen Metabolites", "Androgen Metabolites", etc.
- **Page titles or report headers**: "DUTCH Complete", "Precision Analytical", etc.
- **Patient information**: Name, DOB, patient ID — put patient_sex and test_date in metadata
- **Reference ranges** listed without an actual patient result value
- **Qualitative results**: "normal", "within range" without a numeric value

## For each actual test result, extract:
- name: The specific marker name (e.g., "Etiocholanolone", "b-Pregnanediol", "Free Cortisol (Urine)")
- value: The numeric result value (as a number). For "<0.5" use 0.5, for ">100" use 100
- unit: The unit of measurement. Use creatinine-normalized values (ng/mg or ug/mg) when BOTH raw and normalized values are shown
- timepoint: "waking", "morning", "afternoon", or "night" for diurnal cortisol/cortisone markers. null for all others
- confidence: "high" (clearly readable), "medium" (unusual format or partially obscured), "low" (guessed)
- catalog_match: Match this marker to the closest entry from the DUTCH biomarker catalog below. Use the EXACT catalog name (case-sensitive) if it matches. Set to null if there is no good match

## Creatinine
Extract the creatinine value from the report. It is typically shown in the adrenal section.

## Metadata
Also extract:
- test_date: Date the test was performed (YYYY-MM-DD format, or null)
- patient_sex: "male" or "female" (from report header), or null if not found

## DUTCH biomarker catalog
${catalogLines.join('\n')}
`
}

export const DUTCH_EXTRACTION_SCHEMA = {
  type: 'object' as const,
  properties: {
    test_date: {
      type: 'string' as const,
      description: 'Test date in YYYY-MM-DD format, or empty string if not found',
    },
    patient_sex: {
      type: 'string' as const,
      enum: ['male', 'female', 'unknown'],
      description: 'Patient sex from report header, use "unknown" if not found',
    },
    markers: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          name: {
            type: 'string' as const,
            description: 'Marker name as shown on DUTCH report',
          },
          value: {
            type: 'number' as const,
            description: 'Numeric value',
          },
          unit: {
            type: 'string' as const,
            description:
              'Unit of measurement, prefer creatinine-normalized (ng/mg or ug/mg)',
          },
          timepoint: {
            type: 'string' as const,
            enum: ['waking', 'morning', 'afternoon', 'night', 'none'],
            description:
              'Collection timepoint for diurnal markers (cortisol/cortisone), "none" for all other markers',
          },
          confidence: {
            type: 'string' as const,
            enum: ['high', 'medium', 'low'],
          },
          catalog_match: {
            type: 'string' as const,
            description:
              'Exact name from the DUTCH biomarker catalog that matches this marker, or empty string if no match',
          },
        },
        required: [
          'name',
          'value',
          'unit',
          'timepoint',
          'confidence',
          'catalog_match',
        ] as const,
        additionalProperties: false,
      },
    },
  },
  required: ['test_date', 'patient_sex', 'markers'] as const,
  additionalProperties: false,
}
