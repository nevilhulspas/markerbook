'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Settings } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { setNutritionTargets, type ResolvedTargets } from '@/actions/nutrition-settings'
import { MACRO_KCAL, macroKcal } from '@/lib/validations/nutrition'

type MacroKey = keyof typeof MACRO_KCAL
type GoalMode = 'kcal' | 'grams'
type MacroValues = Record<MacroKey, number | null>

const MACRO_FIELDS: [MacroKey, string][] = [
  ['protein_g', 'Protein'],
  ['carbs_g', 'Carbs'],
  ['fat_g', 'Fat'],
]

function pctToGrams(pct: number, key: MacroKey, calories: number): number {
  return Math.round(((pct / 100) * calories) / MACRO_KCAL[key])
}

function gramsToPct(grams: number, key: MacroKey, calories: number): number {
  return Math.round(((grams * MACRO_KCAL[key]) / calories) * 100)
}

/** Percent shares of the macro-kcal total, largest-remainder rounded so they sum
 *  to exactly 100. Falls back to % of the calorie goal when not all macros are set. */
function seedPcts(grams: MacroValues, calories: number | null): MacroValues {
  const total = macroKcal(grams)
  if (total) {
    const parts = MACRO_FIELDS.map(([key]) => {
      const exact = ((grams[key]! * MACRO_KCAL[key]) / total) * 100
      return { key, pct: Math.floor(exact), frac: exact % 1 }
    })
    let remainder = 100 - parts.reduce((sum, p) => sum + p.pct, 0)
    for (const p of [...parts].sort((a, b) => b.frac - a.frac)) {
      if (remainder <= 0) break
      p.pct += 1
      remainder -= 1
    }
    return Object.fromEntries(parts.map((p) => [p.key, p.pct])) as MacroValues
  }
  return Object.fromEntries(
    MACRO_FIELDS.map(([key]) => {
      const g = grams[key]
      return [key, g != null && calories ? gramsToPct(g, key, calories) : null]
    })
  ) as MacroValues
}

function targetGrams(targets: ResolvedTargets): MacroValues {
  return { protein_g: targets.protein_g, carbs_g: targets.carbs_g, fat_g: targets.fat_g }
}

export function NutritionSettingsSheet({ targets }: { targets: ResolvedTargets }) {
  const router = useRouter()
  const [mode, setMode] = useState<GoalMode>(() =>
    targets.calories == null && MACRO_FIELDS.some(([key]) => targets[key] != null)
      ? 'grams'
      : 'kcal'
  )
  const [calories, setCalories] = useState(targets.calories)
  const [pcts, setPcts] = useState<MacroValues>(() => seedPcts(targetGrams(targets), targets.calories))
  const [grams, setGrams] = useState<MacroValues>(() => targetGrams(targets))
  const [suggested, setSuggested] = useState(targets.suggested)
  const [pending, start] = useTransition()

  // Re-seed local state from props when they change (e.g. after router.refresh()).
  // "Adjust state during render" pattern — avoids a setState-in-effect.
  const [prevTargets, setPrevTargets] = useState(targets)
  if (prevTargets !== targets) {
    setPrevTargets(targets)
    setCalories(targets.calories)
    setPcts(seedPcts(targetGrams(targets), targets.calories))
    setGrams(targetGrams(targets))
    setSuggested(targets.suggested)
  }

  const num = (v: string) => (v === '' ? null : Math.round(Number(v)))

  // In kcal mode the calorie goal is the input and gram targets are derived from
  // the percentages; in grams mode it's the other way around.
  const derivedGrams = Object.fromEntries(
    MACRO_FIELDS.map(([key]) => {
      const pct = pcts[key]
      return [key, pct != null && calories != null ? pctToGrams(pct, key, calories) : null]
    })
  ) as MacroValues
  const derivedCalories = macroKcal(grams)
  const effectiveGrams = mode === 'kcal' ? derivedGrams : grams
  const effectiveCalories = mode === 'kcal' ? calories : derivedCalories

  const pctValues = MACRO_FIELDS.map(([key]) => pcts[key])
  const pctSum = pctValues.reduce<number>((sum, v) => sum + (v ?? 0), 0)
  const allPctsSet = pctValues.every((v) => v != null)
  const somePctsSet = pctValues.some((v) => v != null)
  // All three set: must hit exactly 100. Partially set: must not already exceed 100.
  const pctSumOff =
    mode === 'kcal' && (allPctsSet ? pctSum !== 100 : somePctsSet && pctSum > 100)
  const pctWithoutCalories = mode === 'kcal' && calories == null && somePctsSet
  const invalid = pctSumOff || pctWithoutCalories

  function switchMode(next: GoalMode) {
    if (next === mode) return
    if (next === 'grams') {
      // Carry the current % split over as gram targets (needs a calorie goal).
      if (calories != null) setGrams(derivedGrams)
    } else {
      setCalories(derivedCalories ?? calories)
      setPcts(seedPcts(grams, derivedCalories ?? calories))
    }
    setMode(next)
  }

  function saveTargets() {
    start(async () => {
      const r = await setNutritionTargets({
        calories: effectiveCalories,
        protein_g: effectiveGrams.protein_g,
        carbs_g: effectiveGrams.carbs_g,
        fat_g: effectiveGrams.fat_g,
      })
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success('Goals saved')
      router.refresh()
    })
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Nutrition settings">
          <Settings className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nutrition settings</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 p-4">
          <section className="space-y-3">
            <h3 className="font-medium">
              Daily goals{suggested ? ' (suggested from your stats)' : ''}
            </h3>
            <Tabs value={mode} onValueChange={(v) => switchMode(v as GoalMode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="kcal">Calories + %</TabsTrigger>
                <TabsTrigger value="grams">Grams</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="space-y-1">
              <Label htmlFor="t-calories">Calories (kcal)</Label>
              <Input
                id="t-calories"
                type="number"
                step={1}
                min={0}
                value={effectiveCalories ?? ''}
                disabled={mode === 'grams'}
                onChange={(e) => {
                  setCalories(num(e.target.value))
                  setSuggested(false)
                }}
              />
              {mode === 'grams' && (
                <p className="text-muted-foreground text-xs">
                  {derivedCalories != null
                    ? 'Calculated from your macro goals.'
                    : 'Set all three macros to calculate the calorie goal.'}
                </p>
              )}
            </div>
            {MACRO_FIELDS.map(([key, label]) => {
              const value = mode === 'kcal' ? pcts[key] : grams[key]
              const g = grams[key]
              return (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`t-${key}`}>{label}</Label>
                  <div className="flex items-center gap-3">
                    <InputGroup className="w-28 shrink-0">
                      <InputGroupInput
                        id={`t-${key}`}
                        type="number"
                        step={1}
                        min={0}
                        max={mode === 'kcal' ? 100 : undefined}
                        value={value ?? ''}
                        onChange={(e) => {
                          const v = num(e.target.value)
                          if (mode === 'kcal') setPcts((p) => ({ ...p, [key]: v }))
                          else setGrams((p) => ({ ...p, [key]: v }))
                          setSuggested(false)
                        }}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>{mode === 'kcal' ? '%' : 'g'}</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                    {mode === 'kcal' && derivedGrams[key] != null && (
                      <span className="text-muted-foreground text-xs">≈ {derivedGrams[key]} g</span>
                    )}
                    {mode === 'grams' && g != null && derivedCalories ? (
                      <span className="text-muted-foreground text-xs">
                        ≈ {gramsToPct(g, key, derivedCalories)}% of calories
                      </span>
                    ) : null}
                  </div>
                </div>
              )
            })}
            {pctSumOff && (
              <p className="text-destructive text-sm">
                Percentages must add up to 100% (currently {pctSum}%).
              </p>
            )}
            {pctWithoutCalories && (
              <p className="text-destructive text-sm">Set a calorie goal to use % targets.</p>
            )}
            <Button onClick={saveTargets} disabled={pending || invalid}>
              Save goals
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
