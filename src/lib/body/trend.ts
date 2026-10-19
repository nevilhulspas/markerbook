import { gramsToKg } from './metrics'
import type { DexaScan, BodyLogEntry } from '@/lib/database.types'
import { APP_LOCALE } from '@/lib/locale'

export type TrendMetric =
  | 'body_fat_pct' | 'weight' | 'waist' | 'lean_kg' | 'ffmi' | 'visceral_fat_g'

export interface TrendSeries {
  key: string
  label: string
  color: string
}

export interface TrendResult {
  series: TrendSeries[]
  /** Rows keyed by date, one numeric field per series key, sorted oldest→newest. */
  data: Array<Record<string, number | string | null>>
}

interface SeriesSpec {
  key: string
  label: string
  color: string
  source: 'dexa' | 'log'
  dexaValue?: (s: DexaScan) => number | null
  logValue?: (e: BodyLogEntry) => number | null
}

const C1 = 'var(--chart-1)'
const C2 = 'var(--chart-2)'

// DEXA and scale/log are kept as SEPARATE series (the methods differ in
// accuracy — e.g. DEXA vs smart-scale body-fat %).
const SPECS: Record<TrendMetric, SeriesSpec[]> = {
  body_fat_pct: [
    { key: 'dexa', label: 'DEXA', color: C1, source: 'dexa', dexaValue: (s) => s.body_fat_pct },
    { key: 'scale', label: 'Scale / log', color: C2, source: 'log', logValue: (e) => e.body_fat_pct },
  ],
  weight: [
    { key: 'dexa', label: 'DEXA total', color: C1, source: 'dexa', dexaValue: (s) => s.total_mass_kg },
    { key: 'scale', label: 'Scale / log', color: C2, source: 'log', logValue: (e) => e.weight_kg },
  ],
  waist: [
    { key: 'log', label: 'Waist', color: C1, source: 'log', logValue: (e) => e.waist_cm },
  ],
  lean_kg: [
    { key: 'dexa', label: 'Lean', color: C1, source: 'dexa', dexaValue: (s) => (s.lean_mass_g == null ? null : gramsToKg(s.lean_mass_g)) },
  ],
  ffmi: [
    { key: 'dexa', label: 'FFMI', color: C1, source: 'dexa', dexaValue: (s) => s.ffmi },
  ],
  visceral_fat_g: [
    { key: 'dexa', label: 'Visceral fat', color: C1, source: 'dexa', dexaValue: (s) => s.visceral_fat_g },
  ],
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(APP_LOCALE, { month: 'short', day: 'numeric' })
}

/**
 * PURE: assemble chart series + date-merged rows for a metric, drawing DEXA from
 * `scans` and scale/manual values from `logEntries`. Null values are skipped;
 * rows are sorted oldest→newest by ISO date.
 */
export function buildTrend(
  metric: TrendMetric,
  scans: DexaScan[],
  logEntries: BodyLogEntry[]
): TrendResult {
  const specs = SPECS[metric]
  const rows = new Map<string, Record<string, number | string | null>>()

  const add = (iso: string, key: string, value: number | null) => {
    if (value == null) return
    const existing = rows.get(iso) ?? { date: iso, label: fmtDate(iso) }
    existing[key] = value
    rows.set(iso, existing)
  }

  for (const spec of specs) {
    if (spec.source === 'dexa' && spec.dexaValue) {
      for (const s of scans) add(s.scan_date, spec.key, spec.dexaValue(s))
    } else if (spec.source === 'log' && spec.logValue) {
      for (const e of logEntries) add(e.logged_on, spec.key, spec.logValue(e))
    }
  }

  const data = [...rows.values()].sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  )
  // Only surface series that actually have at least one point.
  const series = specs
    .filter((spec) => data.some((row) => row[spec.key] != null))
    .map((spec) => ({ key: spec.key, label: spec.label, color: spec.color }))

  return { series, data }
}
