import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpenIcon } from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import { getFoodLogs } from '@/actions/nutrition-food-logs'
import { getTopRecipes } from '@/actions/nutrition-logging'
import { getNutritionTargets } from '@/actions/nutrition-settings'
import { getLibrary } from '@/actions/nutrition-library'
import { groupLogsByDay, sumMacros, localDayKey } from '@/lib/nutrition/totals'
import { QuickAdd } from '@/components/nutrition/quick-add'
import { DailyProgress } from '@/components/nutrition/daily-progress'
import { FoodLogList } from '@/components/nutrition/food-log-list'
import { RangeTabs } from '@/components/nutrition/range-tabs'
import { NutritionSettingsSheet } from '@/components/nutrition/nutrition-settings-sheet'
import { Button } from '@/components/ui/button'
import type { LibrarySuggestion } from '@/components/nutrition/suggestion-dropdown'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Nutrition | Markerbook',
}

export default async function NutritionPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const { range = '7d' } = await searchParams
  const [logs, targets, recipes, library] = await Promise.all([
    getFoodLogs(range),
    getNutritionTargets(),
    getTopRecipes(5),
    getLibrary(),
  ])

  const librarySuggestions: LibrarySuggestion[] = [
    ...library.recipes.map((r) => ({
      kind: 'recipe' as const,
      id: r.id,
      name: r.name,
      grams: r.total_grams,
    })),
    ...library.customFoods.map((f) => ({
      kind: 'custom_food' as const,
      id: f.id,
      name: f.name,
      grams: f.default_grams,
    })),
  ]

  const groups = groupLogsByDay(logs)
  const todayKey = localDayKey(new Date())
  const todayTotals = sumMacros(groups.find((g) => g.dayKey === todayKey)?.logs ?? [])
  const visibleGroups = range === 'today' ? groups.filter((g) => g.dayKey === todayKey) : groups

  return (
    <PageContainer width="wide" className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Nutrition</h1>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" aria-label="Library">
            <Link href="/nutrition/library">
              <BookOpenIcon className="size-4" />
            </Link>
          </Button>
          <NutritionSettingsSheet targets={targets} />
        </div>
      </div>
      <QuickAdd recipes={recipes} librarySuggestions={librarySuggestions} />
      <DailyProgress totals={todayTotals} targets={targets} />
      <RangeTabs value={range} />
      <FoodLogList groups={visibleGroups} />
      <p className="text-muted-foreground text-xs">Food data: NEVO (RIVM) · Open Food Facts</p>
    </PageContainer>
  )
}
