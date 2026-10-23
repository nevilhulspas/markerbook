import type { BloodTestFormValues } from '@/lib/validations/blood-test'
import type { ExtractionResult, MatchedMarker } from '@/lib/extraction/types'
import type { DutchParseResult } from '@/lib/dutch/parse'
import { prepareMarkersForSave } from '@/lib/import/prepare-markers-for-save'

/**
 * Build createBloodTest() input from a blood extraction. Uses the import
 * page's own `prepareMarkersForSave`, so custom (non-LOINC) markers are kept
 * and a missing unit falls back to the catalogue unit. A report that lists one
 * marker twice keeps the first row: the import page asks the user to pick one,
 * and in chat a second row would make the whole save fail.
 */
export function bloodExtractionToValues(
  result: ExtractionResult,
  matchedMarkers: MatchedMarker[],
  storagePath: string | null,
  fallbackDate: string
): BloodTestFormValues {
  const { markers: prepared } = prepareMarkersForSave(matchedMarkers)
  const seen = new Set<string>()
  const markers = prepared.filter((m) => {
    const key =
      'biomarker_id' in m
        ? `id:${m.biomarker_id}`
        : 'capture_loinc_code' in m
          ? `loinc:${m.capture_loinc_code}`
          : `custom:${m.name.trim().toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return {
    name: result.lab_name ? `${result.lab_name} — blood test` : 'Imported Lab Report',
    test_date: result.test_date ?? fallbackDate,
    sample_type: result.sample_type,
    pdf_storage_path: storagePath ?? undefined,
    markers,
  }
}

export interface DutchTestValues {
  name: string
  test_date: string
  menstrual_phase?: string | null
  cycle_day?: number | null
  pdf_storage_path?: string
  markers: { biomarker_id: string; value: number; unit: string; timepoint: string }[]
}

/** Build createDutchTest() input from a DUTCH extraction — mirrors the import page. */
export function dutchExtractionToValues(
  result: DutchParseResult['result'],
  matchedMarkers: DutchParseResult['matchedMarkers'],
  storagePath: string | null
): DutchTestValues {
  const markers = matchedMarkers
    .filter((m) => m.selected && m.matched && m.biomarker_id)
    .map((m) => ({
      biomarker_id: m.biomarker_id as string,
      value: m.value,
      unit: m.unit,
      timepoint: m.timepoint,
    }))
  return {
    name: 'DUTCH Test',
    test_date: result.test_date,
    pdf_storage_path: storagePath ?? undefined,
    markers,
  }
}
