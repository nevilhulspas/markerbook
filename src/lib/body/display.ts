import { gramsToKg } from './metrics'
import type { Band } from './reference-bands'
import type { DexaScan, DexaRegionName } from '@/lib/database.types'

/** A scan metric prepared for display + band classification. */
export interface MetricView {
  bandMetric: string // key into reference-bands (or a goal-only metric)
  label: string
  value: number | null // value in the unit reference-bands expects
  display: string
}

function fmt(n: number | null, digits: number, suffix = ''): string {
  return n == null ? '—' : `${n.toFixed(digits)}${suffix}`
}

/** The headline metrics for a scan, in band/display-ready form. */
export function scanMetricViews(scan: DexaScan): MetricView[] {
  const leanKg = scan.lean_mass_g == null ? null : gramsToKg(scan.lean_mass_g)
  const vat = scan.visceral_fat_g
  return [
    { bandMetric: 'body_fat_pct', label: 'Body fat', value: scan.body_fat_pct, display: fmt(scan.body_fat_pct, 1, '%') },
    { bandMetric: 'lean_mass_kg', label: 'Lean mass', value: leanKg, display: fmt(leanKg, 1, ' kg') },
    { bandMetric: 'total_mass_kg', label: 'Total mass', value: scan.total_mass_kg, display: fmt(scan.total_mass_kg, 1, ' kg') },
    { bandMetric: 'visceral_fat_g', label: 'Visceral fat', value: vat, display: vat == null ? '—' : `${Math.round(vat)} g` },
    { bandMetric: 'ffmi', label: 'FFMI', value: scan.ffmi, display: fmt(scan.ffmi, 1, ' kg/m²') },
    { bandMetric: 'almi', label: 'ALMI', value: scan.almi, display: fmt(scan.almi, 1, ' kg/m²') },
    { bandMetric: 'bone_t_score', label: 'Bone T-score', value: scan.bone_t_score, display: fmt(scan.bone_t_score, 1) },
    { bandMetric: 'android_gynoid_ratio', label: 'A/G ratio', value: scan.android_gynoid_ratio, display: fmt(scan.android_gynoid_ratio, 2) },
  ]
}

/** Tailwind text/badge classes for a band. */
export function bandColorClass(band: Band | null): string {
  switch (band) {
    case 'excellent':
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
    case 'good':
      return 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
    case 'fair':
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
    case 'needs_focus':
      return 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

/** Which direction is "better" for a goal metric (drives gap-to-target color). */
export function goalDirection(metric: string): 'higher_better' | 'lower_better' | 'neutral' {
  switch (metric) {
    case 'body_fat_pct':
    case 'visceral_fat_g':
      return 'lower_better'
    case 'lean_mass_kg':
    case 'ffmi':
    case 'almi':
    case 'bone_t_score':
      return 'higher_better'
    default:
      // total_mass_kg etc. — whether higher/lower is "better" is user-dependent.
      return 'neutral'
  }
}

/** Display unit suffix for a metric value/target. */
export function metricUnit(metric: string): string {
  switch (metric) {
    case 'body_fat_pct':
      return '%'
    case 'lean_mass_kg':
    case 'total_mass_kg':
      return ' kg'
    case 'visceral_fat_g':
      return ' g'
    case 'ffmi':
    case 'almi':
      return ' kg/m²'
    default:
      return ''
  }
}

export type TargetTone = 'good' | 'bad' | 'neutral'

export interface TargetInfo {
  target: string // formatted target, e.g. "15%"
  gapText: string // e.g. "on target", "11.2 over", "3.1 under"
  tone: TargetTone
}

/** Build the gap-to-target line for a metric card, or null if no target/value. */
export function targetInfo(
  bandMetric: string,
  value: number | null,
  targetValue: number | null
): TargetInfo | null {
  if (targetValue == null) return null
  const unit = metricUnit(bandMetric)
  const target = `${targetValue}${unit}`
  if (value == null) return { target, gapText: '', tone: 'neutral' }

  const gap = value - targetValue
  const mag = Math.abs(gap)
  const EPS = 0.05
  if (mag <= EPS) return { target, gapText: 'on target', tone: 'good' }

  const dir = goalDirection(bandMetric)
  let tone: TargetTone = 'neutral'
  if (dir !== 'neutral') {
    const overIsGood = dir === 'higher_better'
    tone = gap > 0 === overIsGood ? 'good' : 'bad'
  }
  return { target, gapText: `${mag.toFixed(1)}${unit} ${gap > 0 ? 'over' : 'under'}`, tone }
}

export const REGION_LABELS: Record<DexaRegionName, string> = {
  total: 'Total', arms: 'Arms', arm_left: 'Arm (L)', arm_right: 'Arm (R)',
  legs: 'Legs', leg_left: 'Leg (L)', leg_right: 'Leg (R)',
  trunk: 'Trunk', trunk_left: 'Trunk (L)', trunk_right: 'Trunk (R)',
  android: 'Android', gynoid: 'Gynoid', head: 'Head', ribs: 'Ribs',
  spine: 'Spine', pelvis: 'Pelvis',
}
