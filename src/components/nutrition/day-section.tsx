import type { DayGroup } from '@/lib/nutrition/totals'
import { groupDayIntoMealSections } from '@/lib/nutrition/totals'
import { APP_LOCALE } from '@/lib/locale'
import { FoodLogItem } from './food-log-item'
import { DayAddDialog } from './day-add-dialog'

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
}

export function DaySection({ group }: { group: DayGroup }) {
  const sections = groupDayIntoMealSections(group.logs)

  return (
    <div className="space-y-3">
      {/* Day header */}
      <div className="flex items-center justify-between">
        <h2 className="font-medium">
          {group.date.toLocaleDateString(APP_LOCALE, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm tabular-nums">
            {Math.round(group.totals.calories)} kcal · {Math.round(group.totals.protein_g)}p /{' '}
            {Math.round(group.totals.carbs_g)}c / {Math.round(group.totals.fat_g)}f
          </span>
          <DayAddDialog dayKey={group.dayKey} />
        </div>
      </div>

      {/* Meal sections */}
      <div className="space-y-2">
        {sections.map((section) => (
          <div key={section.meal} className="space-y-1">
            {/* Meal header */}
            <div className="flex items-baseline gap-2 px-0.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {MEAL_LABELS[section.meal] ?? section.meal}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                · {Math.round(section.totals.calories)} kcal ·{' '}
                {Math.round(section.totals.protein_g)}p /{' '}
                {Math.round(section.totals.carbs_g)}c /{' '}
                {Math.round(section.totals.fat_g)}f
              </span>
            </div>

            {/* Submissions */}
            <div className="divide-y rounded-lg border">
              {section.submissions.map((sub) => {
                const showRawInput =
                  sub.logs.length > 1 ||
                  (sub.rawInput != null &&
                    sub.rawInput !== sub.logs[0]?.food_name)

                return (
                  <div key={sub.submissionId}>
                    {showRawInput && sub.rawInput && (
                      <p className="px-3 pt-2 text-xs italic text-muted-foreground">
                        &ldquo;{sub.rawInput}&rdquo;
                      </p>
                    )}
                    {sub.logs.map((l) => (
                      <FoodLogItem key={l.id} log={l} />
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
