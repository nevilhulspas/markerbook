import type { FoodLog, MealType } from '@/lib/database.types'
import { bucketMealTime } from './parse'

export interface MacroTotals {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface DayGroup {
  dayKey: string
  date: Date
  logs: FoodLog[]
  totals: MacroTotals
}

// --- Meal-section grouping ---------------------------------------------------

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner']

export interface SubmissionGroup {
  submissionId: string
  rawInput: string | null
  logs: FoodLog[]
  totals: MacroTotals
}

export interface MealSection {
  meal: MealType
  logs: FoodLog[]
  submissions: SubmissionGroup[]
  totals: MacroTotals
}

/**
 * Groups a day's logs into meal sections (ordered B/L/S/D, empty omitted).
 * Within each section, logs are grouped by submission_id (fallback: log.id),
 * newest submission first; logs within a submission keep their given order.
 */
export function groupDayIntoMealSections(dayLogs: FoodLog[]): MealSection[] {
  // Assign each log to a meal bucket
  const byMeal = new Map<MealType, FoodLog[]>()
  for (const log of dayLogs) {
    const meal: MealType = log.meal_type ?? bucketMealTime(new Date(log.entry_date))
    const arr = byMeal.get(meal) ?? []
    arr.push(log)
    byMeal.set(meal, arr)
  }

  const sections: MealSection[] = []
  for (const meal of MEAL_ORDER) {
    const mealLogs = byMeal.get(meal)
    if (!mealLogs || mealLogs.length === 0) continue

    // Group by submission_id (fallback: log.id), preserving recency order
    // of submissions (newest first). We track submission order by the first
    // encountered submission key (list is newest-first from getFoodLogs).
    const submissionOrder: string[] = []
    const submissionMap = new Map<string, FoodLog[]>()
    for (const log of mealLogs) {
      const key = log.submission_id ?? log.id
      if (!submissionMap.has(key)) {
        submissionOrder.push(key)
        submissionMap.set(key, [])
      }
      submissionMap.get(key)!.push(log)
    }

    const submissions: SubmissionGroup[] = submissionOrder.map((key) => {
      const logs = submissionMap.get(key)!
      return {
        submissionId: key,
        rawInput: logs[0]?.raw_input ?? null,
        logs,
        totals: sumMacros(logs),
      }
    })

    sections.push({
      meal,
      logs: mealLogs,
      submissions,
      totals: sumMacros(mealLogs),
    })
  }

  return sections
}

/** yyyy-mm-dd in the runtime's local timezone. */
export function localDayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function sumMacros(logs: FoodLog[]): MacroTotals {
  return logs.reduce<MacroTotals>(
    (t, l) => ({
      calories: t.calories + (l.calories ?? 0),
      protein_g: t.protein_g + (l.protein_g ?? 0),
      carbs_g: t.carbs_g + (l.carbs_g ?? 0),
      fat_g: t.fat_g + (l.fat_g ?? 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )
}

/** Groups logs by local calendar day, newest day first. Assumes each log's
 *  `entry_date` is a full ISO timestamp (the insert paths call toISOString()),
 *  not a bare yyyy-mm-dd — date-only strings would parse as UTC midnight and
 *  could misgroup in western timezones. */
export function groupLogsByDay(logs: FoodLog[]): DayGroup[] {
  const byDay = new Map<string, FoodLog[]>()
  for (const l of logs) {
    const key = localDayKey(new Date(l.entry_date))
    const arr = byDay.get(key) ?? []
    arr.push(l)
    byDay.set(key, arr)
  }
  return [...byDay.entries()]
    .map(([dayKey, dayLogs]) => ({
      dayKey,
      date: new Date(`${dayKey}T00:00:00`),
      logs: dayLogs,
      totals: sumMacros(dayLogs),
    }))
    .sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1))
}
