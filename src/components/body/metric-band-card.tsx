import { classifyMetric } from '@/lib/body/reference-bands'
import { bandColorClass, targetInfo, type MetricView, type TargetTone } from '@/lib/body/display'
import { cn } from '@/lib/utils'
import type { Sex } from '@/lib/database.types'

interface MetricBandCardProps {
  view: MetricView
  sex: Sex | null
  age?: number | null
  /** The user's target for this metric (numeric, in display units). */
  targetValue?: number | null
  /** Already-formatted change-vs-previous string. */
  delta?: string | null
}

const TONE_CLASS: Record<TargetTone, string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  bad: 'text-rose-600 dark:text-rose-400',
  neutral: 'text-muted-foreground',
}

/**
 * A single metric tile: value, a reference-band status chip (when the metric has
 * population bands), change-vs-previous, and gap-to-target (colored by whether
 * you're on the good side of your goal).
 */
export function MetricBandCard({ view, sex, age, targetValue, delta }: MetricBandCardProps) {
  const { band, label } = classifyMetric(view.bandMetric, view.value, {
    sex: (sex as 'male' | 'female' | 'other' | null) ?? null,
    age,
  })
  const target = targetInfo(view.bandMetric, view.value, targetValue ?? null)

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-muted-foreground">{view.label}</span>
        {band && (
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', bandColorClass(band))}>
            {label}
          </span>
        )}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{view.display}</div>
      {delta && <div className="mt-1 text-xs text-muted-foreground tabular-nums">{delta}</div>}
      {target && (
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
          <span className="text-muted-foreground">target {target.target}</span>
          {target.gapText && <span className={cn('tabular-nums', TONE_CLASS[target.tone])}>· {target.gapText}</span>}
        </div>
      )}
    </div>
  )
}
