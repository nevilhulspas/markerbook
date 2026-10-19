import type { RmrTest } from '@/lib/database.types'

/**
 * A figure with a label, used for the headline RMR numbers.
 */
function Stat({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

/**
 * Latest-RMR summary: measured vs predicted resting metabolic rate and the
 * carb/fat fuel mix (from RER). Read-only — TDEE targets live on the detail page.
 */
export function RmrCard({ test }: { test: RmrTest }) {
  const measured = Math.round(test.rmr_kcal)
  const predicted = test.predicted_rmr_kcal == null ? null : Math.round(test.predicted_rmr_kcal)
  // Positive = measured above predicted (e.g. measured 2229 vs predicted 1887 → +342).
  const vsPredicted =
    predicted == null ? null : measured - predicted

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <Stat
        label="Measured RMR"
        value={`${measured}`}
        sub={
          vsPredicted == null
            ? 'kcal/day'
            : `${vsPredicted >= 0 ? '+' : ''}${vsPredicted} vs predicted`
        }
      />
      <Stat
        label="Predicted RMR"
        value={predicted == null ? '—' : `${predicted}`}
        sub="kcal/day"
      />
      <Stat
        label="Fuel — carbs"
        value={test.fuel_carb_pct == null ? '—' : `${Math.round(test.fuel_carb_pct)}%`}
        sub={test.rer == null ? undefined : `RER ${test.rer}`}
      />
      <Stat
        label="Fuel — fat"
        value={test.fuel_fat_pct == null ? '—' : `${Math.round(test.fuel_fat_pct)}%`}
      />
    </div>
  )
}
