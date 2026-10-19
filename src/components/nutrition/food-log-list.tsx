import type { DayGroup } from '@/lib/nutrition/totals'
import { DaySection } from './day-section'

export function FoodLogList({ groups }: { groups: DayGroup[] }) {
  if (groups.length === 0) {
    return <p className="text-muted-foreground text-sm">No meals logged yet.</p>
  }
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <DaySection key={g.dayKey} group={g} />
      ))}
    </div>
  )
}
