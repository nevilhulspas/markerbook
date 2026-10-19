import { parseUnit, sameUnit } from './parse'

/**
 * One marker's unit knowledge: its catalogue (display default) unit and the
 * factors from `biomarker_units` / `dutch_marker_units`, where
 * value_in_unit × conversion_factor = value_in_catalogue_unit.
 */
export interface MarkerUnits {
  catalogueUnit: string
  factors: ReadonlyArray<{ unit: string; conversion_factor: number }>
  loincCode?: string | null
  name?: string | null
  /** Average molar mass in g/mol (from LOINC → ChEBI/PubChem or a lab convention). */
  molarMass?: number | null
  /** Charge number, for mEq ↔ mmol. */
  valence?: number | null
  /** Units labs commonly use for this substance (LOINC example units), offered as choices. */
  typicalUnits?: ReadonlyArray<string>
}

/** Convert between two units of the same kind (prefix / spelling only). */
function direct(value: number, from: string, to: string): number | null {
  const a = parseUnit(from)
  const b = parseUnit(to)
  if (a.kind === 'opaque' || b.kind === 'opaque') {
    return a.kind === b.kind && a.key === b.key ? value : null
  }
  if (a.kind !== b.kind) return null
  return (value * a.scale) / b.scale
}

const HBA1C_LOINC = new Set(['4548-4', '17856-6', '59261-8', '41995-2'])

function isHbA1c(marker: MarkerUnits | undefined): boolean {
  if (!marker) return false
  if (marker.loincCode && HBA1C_LOINC.has(marker.loincCode)) return true
  return /\b(hba1c|a1c|glycated h(a)?emoglobin)\b/i.test(marker.name ?? '')
}

/**
 * HbA1c is reported as NGSP % or IFCC mmol/mol. The relation is linear, not a
 * plain factor: % = 0.09148 × mmol/mol + 2.152 (IFCC–NGSP master equation).
 */
function convertHbA1c(value: number, from: string, to: string): number | null {
  const f = parseUnit(from)
  const t = parseUnit(to)
  const isPct = (u: typeof f) => u.kind === 'fraction' && u.key === '%'
  const isIfcc = (u: typeof f) => u.kind === 'opaque' && u.key === 'mmol/mol'
  if (isIfcc(f) && isPct(t)) return 0.09148 * value + 2.152
  if (isPct(f) && isIfcc(t)) return (value - 2.152) / 0.09148
  return null
}

/**
 * Convert `value` from `from` to `to` for this marker, or null when it is not
 * possible. Never guesses: a null means "show the value in its own unit".
 *
 * Order: same unit or same kind (µg/L → ng/mL); HbA1c's linear relation; then
 * through the marker's catalogue factors (mass ↔ amount, e.g. ng/mL ↔ nmol/L),
 * where each side may differ from a catalogue unit in prefix only.
 */
export function convertUnit(
  value: number,
  from: string,
  to: string,
  marker?: MarkerUnits
): number | null {
  if (!Number.isFinite(value)) return null
  const d = direct(value, from, to)
  if (d !== null) return d
  if (isHbA1c(marker)) {
    const h = convertHbA1c(value, from, to)
    if (h !== null) return h
  }
  if (!marker) return null

  const anchors = [
    { unit: marker.catalogueUnit, conversion_factor: 1 },
    ...marker.factors.filter((f) => Number.isFinite(f.conversion_factor) && f.conversion_factor > 0),
  ]
  for (const a of anchors) {
    const inA = direct(value, from, a.unit)
    if (inA === null) continue
    const catalogueValue = inA * a.conversion_factor
    for (const b of anchors) {
      const inB = catalogueValue / b.conversion_factor
      const out = direct(inB, b.unit, to)
      if (out !== null) return out
    }
  }
  return viaMolarMass(value, from, to, marker)
}

/**
 * Mass ↔ amount ↔ equivalents for one substance: g/L = mol/L × molar mass,
 * eq/L = mol/L × valence. Null when the marker has no molar mass (or no
 * valence for eq) or a side is not one of these kinds.
 */
function viaMolarMass(value: number, from: string, to: string, marker: MarkerUnits): number | null {
  const M = marker.molarMass && marker.molarMass > 0 ? marker.molarMass : null
  const v = marker.valence && marker.valence > 0 ? marker.valence : null
  const a = parseUnit(from)
  const b = parseUnit(to)
  const toMol = (x: number, k: typeof a): number | null => {
    if (k.kind === 'amount') return x * k.scale
    if (k.kind === 'mass') return M ? (x * k.scale) / M : null
    if (k.kind === 'eq') return v ? (x * k.scale) / v : null
    return null
  }
  const mol = toMol(value, a)
  if (mol === null) return null
  if (b.kind === 'amount') return mol / b.scale
  if (b.kind === 'mass') return M ? (mol * M) / b.scale : null
  if (b.kind === 'eq') return v ? (mol * v) / b.scale : null
  return null
}

/** True when a value in `unit` can be shown in the marker's catalogue unit. */
export function isConvertible(unit: string, marker: MarkerUnits): boolean {
  return convertUnit(1, unit, marker.catalogueUnit, marker) !== null
}

/**
 * The spelling to store for a unit someone picked or a lab printed: the
 * marker's own spelling when it is the same unit ("ug/l" → "µg/L" if the
 * catalogue writes it that way), otherwise the input trimmed. The value is
 * never changed: a result is always stored in the unit it was entered in.
 */
export function storageSpelling(unit: string, marker?: MarkerUnits): string {
  const trimmed = unit.trim()
  if (!marker) return trimmed
  const known = [marker.catalogueUnit, ...marker.factors.map((f) => f.unit)]
  return known.find((k) => sameUnit(k, trimmed)) ?? trimmed
}

/** The units offered when entering a result: the marker's known units. */
export function inputUnitOptions(marker: MarkerUnits, extra?: string | null): string[] {
  const out: string[] = []
  const add = (u: string | null | undefined) => {
    if (!u || !u.trim()) return
    if (!out.some((o) => sameUnit(o, u))) out.push(u.trim())
  }
  add(marker.catalogueUnit)
  for (const f of marker.factors) add(f.unit)
  for (const u of marker.typicalUnits ?? []) add(u)
  add(extra)
  return out
}

export interface DisplayValue {
  value: number
  unit: string
  /** False when the value could not be converted and keeps its own unit. */
  inDisplayUnit: boolean
}

/**
 * A stored result (value + the unit it was entered in) for display in
 * `displayUnit`. When that is not possible the value keeps its own unit and
 * `inDisplayUnit` is false, so callers can mark it and leave it out of charts
 * and comparisons instead of mixing units.
 */
export function toDisplay(
  value: number,
  storedUnit: string,
  displayUnit: string,
  marker?: MarkerUnits
): DisplayValue {
  const converted = convertUnit(value, storedUnit, displayUnit, marker)
  if (converted === null) return { value, unit: storedUnit, inDisplayUnit: false }
  return { value: converted, unit: displayUnit, inDisplayUnit: true }
}

/**
 * A number for display with enough significant digits for small values
 * (0.035 stays 0.035, 0.905 stays 0.905) and no noise on large ones.
 */
export function formatUnitValue(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  const abs = Math.abs(value)
  if (abs === 0) return '0'
  if (abs >= 1000) return String(Math.round(value))
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 2 : Math.min(6, 2 - Math.floor(Math.log10(abs)))
  return String(Number(value.toFixed(digits)))
}
