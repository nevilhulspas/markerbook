import Link from 'next/link'

import {
  ACTIVITY_MULTIPLIER,
  fatLossRange,
  leanGainRange,
  tdee,
} from '@/lib/rmr/tdee'
import type { ActivityLevel } from '@/lib/database.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { APP_LOCALE } from '@/lib/locale'

// Display labels match the profile form's activity-level options. Order matches
// the ACTIVITY_MULTIPLIER record (sedentary → very_active).
const LEVELS: { key: ActivityLevel; label: string }[] = [
  { key: 'sedentary', label: 'Sedentary' },
  { key: 'light', label: 'Lightly Active' },
  { key: 'moderate', label: 'Moderately Active' },
  { key: 'active', label: 'Active' },
  { key: 'very_active', label: 'Very Active' },
]

function fmtRange([lo, hi]: [number, number]): string {
  return `${lo.toLocaleString(APP_LOCALE)}–${hi.toLocaleString(APP_LOCALE)}`
}

/**
 * Calorie-targets table derived from a measured RMR across all five activity
 * levels. The user's level (from their profile) is highlighted; when unknown,
 * the table renders unhighlighted with a hint to set it on the profile.
 */
export function TdeeCard({
  rmrKcal,
  activityLevel,
}: {
  rmrKcal: number
  activityLevel: ActivityLevel | null
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Calorie targets (TDEE)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activityLevel == null && (
          <p className="text-sm text-muted-foreground">
            Set your activity level on your{' '}
            <Link href="/profile" className="underline underline-offset-2">
              profile
            </Link>{' '}
            to highlight the row that matches you.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Activity level</th>
                <th className="py-2 pr-4 font-medium">Fat loss</th>
                <th className="py-2 pr-4 font-medium">Maintain (TDEE)</th>
                <th className="py-2 font-medium">Lean gain</th>
              </tr>
            </thead>
            <tbody>
              {LEVELS.map(({ key, label }) => {
                const t = tdee(rmrKcal, key)
                const isUser = key === activityLevel
                return (
                  <tr
                    key={key}
                    className={cn(
                      'border-b last:border-0',
                      isUser && 'bg-primary/10 font-medium'
                    )}
                  >
                    <td className="py-2 pr-4">
                      {label}
                      {isUser && (
                        <span className="ml-2 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                          You
                        </span>
                      )}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ×{ACTIVITY_MULTIPLIER[key]}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{fmtRange(fatLossRange(t))}</td>
                    <td className="py-2 pr-4">{t.toLocaleString(APP_LOCALE)}</td>
                    <td className="py-2">{fmtRange(leanGainRange(t))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground">
          All values in kcal/day. Fat loss is a 500–1,000 kcal/day deficit; lean gain a
          250–500 kcal/day surplus. Estimates, not medical advice.
        </p>
      </CardContent>
    </Card>
  )
}
