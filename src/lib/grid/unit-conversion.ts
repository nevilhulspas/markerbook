import type { BiomarkerUnit } from '@/lib/database.types'
import { convertUnit, formatUnitValue, type MarkerUnits } from '@/lib/units/convert'
import { parseUnit } from '@/lib/units/parse'

/**
 * A comparison key for a unit: two units get the same key when they are the
 * same unit, also across spelling and equal-scale prefixes ("ug/l" and
 * "ng/mL", "IU/L" and "mIU/mL", "G/l" and "x10^3/uL"). Use it to compare or
 * look up units, never to display them.
 */
export function normalizeUnit(unit: string): string {
  const p = parseUnit(unit)
  if (p.kind === 'opaque') return `opaque:${p.key}`
  return `${p.kind}:${Number(p.scale.toPrecision(10))}`
}

/** The catalogue facts a conversion may use for one biomarker. */
export interface UnitContext {
  /** The biomarker's catalogue unit (`biomarkers.unit`). */
  unit: string
  loinc_code?: string | null
  name?: string | null
}

function markerUnits(units: BiomarkerUnit[], marker?: UnitContext): MarkerUnits {
  const catalogueUnit =
    marker?.unit ?? units.find((u) => u.is_default)?.unit ?? units.find((u) => u.conversion_factor === 1)?.unit ?? ''
  return {
    catalogueUnit,
    factors: units.map((u) => ({ unit: u.unit, conversion_factor: Number(u.conversion_factor) })),
    loincCode: marker?.loinc_code ?? null,
    name: marker?.name ?? null,
  }
}

/**
 * Convert a value from one unit to another for a biomarker: by prefix and
 * spelling for units of one kind, by the catalogue factors in `units`
 * (value_in_unit × conversion_factor = value_in_catalogue_unit) for mass ↔
 * amount, and by the IFCC–NGSP equation for HbA1c.
 *
 * Returns `null` when the conversion is NOT possible. Callers MUST then keep
 * the original value and unit: relabelling the input as the target unit
 * mislabels the number (9 mmol/L hemoglobin is about 14.5 g/dL, not "9 g/dL").
 */
export function convertValue(
  value: number,
  fromUnit: string,
  toUnit: string,
  units: BiomarkerUnit[],
  marker?: UnitContext
): number | null {
  return convertUnit(value, fromUnit, toUnit, markerUnits(units, marker))
}

/**
 * Get the default unit for a biomarker from its units list.
 */
export function getDefaultUnit(units: BiomarkerUnit[]): string | null {
  return units.find((u) => u.is_default)?.unit ?? units[0]?.unit ?? null
}

/**
 * Format a value for display: enough significant digits for small values.
 */
export function formatConverted(value: number): string {
  return formatUnitValue(value)
}

/** Map of biomarker_id -> preferred unit string */
export type UnitPreferenceMap = Map<string, string>
