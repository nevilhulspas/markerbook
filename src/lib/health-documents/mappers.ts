import type { BloodTestFormValues } from '@/lib/validations/blood-test'
import type { ExtractionResult, MatchedMarker } from '@/lib/extraction/types'
import type { DutchParseResult } from '@/lib/dutch/parse'

/** Build createBloodTest() input from a blood extraction — mirrors the import page. */
export function bloodExtractionToValues(
  result: ExtractionResult,
  matchedMarkers: MatchedMarker[],
  storagePath: string | null,
  fallbackDate: string
): BloodTestFormValues {
  const markers = matchedMarkers
    .filter((m) => m.selected && (m.biomarker_id || m.capture_loinc_code))
    .map((m) => {
      const base = {
        value: m.value,
        unit: m.unit,
        ref_range_low: m.ref_range_low ?? null,
        ref_range_high: m.ref_range_high ?? null,
      }
      if (m.biomarker_id) {
        return { biomarker_id: m.biomarker_id, ...base }
      }
      // Forward the raw lab name so commitCapture can store it as a match alias.
      return { capture_loinc_code: m.capture_loinc_code!, name: m.name, ...base }
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
