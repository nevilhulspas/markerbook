import type { Biomarker, BiomarkerUnit, ReferenceRange } from '@/lib/database.types'
import { markerUnitsFor, resolveResultRange } from '@/lib/units/result-range'
import { convertUnit } from '@/lib/units/convert'
import type { MarkerContext } from './types'

/**
 * One stored result as the AI sees it. The range is compared in a unit the
 * value converts to, and the value is sent in that same unit, so the AI never
 * reads a value against a range in another unit. Shared by the test page (the
 * "Interpret" button) and the server routes that rebuild the prompt.
 */
export function toMarkerContext(
  result: { value: number; unit: string; biomarkers: Biomarker },
  ranges: ReferenceRange[],
  units: BiomarkerUnit[] | undefined,
  sex: 'male' | 'female' | null
): MarkerContext {
  const bm = result.biomarkers
  const marker = markerUnitsFor(bm, units)
  const range = resolveResultRange(result.value, result.unit, bm, ranges, marker, sex)
  const inRangeUnit = range.unit ? convertUnit(result.value, result.unit, range.unit, marker) : null
  return {
    name: bm.name,
    shortName: bm.short_name,
    value: inRangeUnit ?? result.value,
    unit: inRangeUnit !== null && range.unit ? range.unit : result.unit,
    category: bm.category,
    refRangeLow: range.low,
    refRangeHigh: range.high,
    status: range.status,
  }
}
