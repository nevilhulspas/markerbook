/**
 * Read a lab unit string into a dimension ("kind") and a scale to that kind's
 * base unit, so units that differ only in spelling or prefix can be compared
 * and converted without a per-marker table:
 *
 *   ng/mL, µg/L, ug/l            → mass/volume,  scale to g/L
 *   nmol/L, µmol/l, micromol/l   → amount/volume, scale to mol/L
 *   mIU/mL, IU/L, mU/l, mE/l     → units/volume,  scale to IU/L
 *   ×10^3/µL, 10^9/L, G/l, /nl   → count/volume,  scale to 1/L
 *   %, L/L                       → fraction
 *
 * Anything else (mm/h, fL, pg, mL/min/1.73m², ratio, mmol/mol, …) is "opaque":
 * it only equals itself after spelling normalisation. Two units of different
 * kinds are never converted here; that needs a marker-specific factor.
 */

export type UnitKind = 'mass' | 'amount' | 'units' | 'count' | 'fraction' | 'eq' | 'opaque'

export interface ParsedUnit {
  kind: UnitKind
  /** Multiply a value in this unit by `scale` to get the kind's base unit. */
  scale: number
  /** Normalised spelling, used to compare opaque units. */
  key: string
}

const MASS: Record<string, number> = { kg: 1e3, g: 1, mg: 1e-3, ug: 1e-6, ng: 1e-9, pg: 1e-12, fg: 1e-15 }
const AMOUNT: Record<string, number> = { mol: 1, mmol: 1e-3, umol: 1e-6, nmol: 1e-9, pmol: 1e-12, fmol: 1e-15 }
const UNITS: Record<string, number> = { iu: 1, u: 1, e: 1, miu: 1e-3, mu: 1e-3, me: 1e-3, uiu: 1e-6, uu: 1e-6, ku: 1e3, kiu: 1e3 }
const EQ: Record<string, number> = { eq: 1, meq: 1e-3, ueq: 1e-6 }
const VOLUME: Record<string, number> = { l: 1, dl: 0.1, cl: 0.01, ml: 1e-3, ul: 1e-6, nl: 1e-9, pl: 1e-12, fl: 1e-15 }

/** Lower-case, ASCII micro, no spaces, unicode superscripts and × resolved. */
export function normalizeUnitSpelling(raw: string): string {
  return raw
    .trim()
    .replace(/[µμ]/g, 'u')
    .replace(/micro/gi, 'u')
    .replace(/mcg/gi, 'ug')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (sup) => '^' + [...sup].map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)).join(''))
    .replace(/[×·*]/g, 'x')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/** Opaque units that are the same thing written differently. */
const OPAQUE_ALIASES: Record<string, string> = {
  'mm/hr': 'mm/h',
  'mm/hour': 'mm/h',
  'mm/uur': 'mm/h',
  'mm/1sth': 'mm/h',
  'ml/min/1.73m2': 'ml/min/1.73m2',
  'ml/min/1,73m2': 'ml/min/1.73m2',
  'ml/min/1.73m^2': 'ml/min/1.73m2',
  'pg/cell': 'pg',
  'mmol/mol': 'mmol/mol',
  'fl': 'fl',
}

/** Count prefixes written as powers of ten ("10^9", "10e9", "x10^3"). */
function powerOfTen(s: string): number | null {
  const m = s.match(/^x?10(?:\^|e)?(\d{1,2})$/)
  return m ? 10 ** Number(m[1]) : null
}

export function parseUnit(raw: string | null | undefined): ParsedUnit {
  const original = (raw ?? '').trim()
  // Count units use upper-case SI letters for giga/tera ("G/l", "T/l"), which
  // collide with grams once lower-cased, so read them before normalising.
  const giga = original.match(/^([GT])\/[lL]$/)
  if (giga) return { kind: 'count', scale: giga[1] === 'G' ? 1e9 : 1e12, key: giga[1] === 'G' ? '10^9/l' : '10^12/l' }

  const s = normalizeUnitSpelling(original)
  if (!s) return { kind: 'opaque', scale: 1, key: '' }
  if (s === '%') return { kind: 'fraction', scale: 0.01, key: '%' }
  if (s === 'l/l' || s === 'fraction') return { kind: 'fraction', scale: 1, key: 'l/l' }
  if (OPAQUE_ALIASES[s]) return { kind: 'opaque', scale: 1, key: OPAQUE_ALIASES[s] }

  const slash = s.indexOf('/')
  if (slash > 0 || s.startsWith('/')) {
    const num = s.slice(0, slash)
    const den = s.slice(slash + 1)
    const vol = VOLUME[den]
    if (vol !== undefined) {
      if (num === '' || num === 'cells') return { kind: 'count', scale: 1 / vol, key: `/${den}` }
      const p = powerOfTen(num)
      if (p !== null) return { kind: 'count', scale: p / vol, key: `${num}/${den}` }
      if (num === 'k' || num === 'thou') return { kind: 'count', scale: 1e3 / vol, key: `${num}/${den}` }
      if (MASS[num] !== undefined) return { kind: 'mass', scale: MASS[num] / vol, key: s }
      if (AMOUNT[num] !== undefined) return { kind: 'amount', scale: AMOUNT[num] / vol, key: s }
      if (UNITS[num] !== undefined) return { kind: 'units', scale: UNITS[num] / vol, key: s }
      if (EQ[num] !== undefined) return { kind: 'eq', scale: EQ[num] / vol, key: s }
    }
  }
  return { kind: 'opaque', scale: 1, key: s }
}

/** True when two unit strings are the same unit (spelling, prefix and scale). */
export function sameUnit(a: string, b: string): boolean {
  const pa = parseUnit(a)
  const pb = parseUnit(b)
  if (pa.kind === 'opaque' || pb.kind === 'opaque') return pa.kind === pb.kind && pa.key === pb.key
  return pa.kind === pb.kind && Math.abs(pa.scale / pb.scale - 1) < 1e-9
}
