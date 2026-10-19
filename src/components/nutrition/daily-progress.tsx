import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MacroTotals } from '@/lib/nutrition/totals'
import type { ResolvedTargets } from '@/actions/nutrition-settings'

function Bar({
  label,
  value,
  target,
  unit,
  color,
}: {
  label: string
  value: number
  target: number | null
  unit: string
  color: string
}) {
  const pct = target && target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          {Math.round(value)}
          {target != null ? ` / ${target}` : ''} {unit}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export function DailyProgress({
  totals,
  targets,
}: {
  totals: MacroTotals
  targets: ResolvedTargets
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Today{targets.suggested ? ' · suggested goals' : ''}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Bar label="Calories" value={totals.calories} target={targets.calories} unit="kcal" color="var(--macro-calories)" />
        <Bar label="Protein" value={totals.protein_g} target={targets.protein_g} unit="g" color="var(--macro-protein)" />
        <Bar label="Carbs" value={totals.carbs_g} target={targets.carbs_g} unit="g" color="var(--macro-carbs)" />
        <Bar label="Fat" value={totals.fat_g} target={targets.fat_g} unit="g" color="var(--macro-fat)" />
      </CardContent>
    </Card>
  )
}
