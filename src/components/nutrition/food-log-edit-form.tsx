'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import type { FoodLog } from '@/lib/database.types'
import { manualFoodLogSchema, type ManualFoodLogInput } from '@/lib/validations/nutrition'
import { updateFoodLog, updateFoodLogGrams } from '@/actions/nutrition-food-logs'
import { getRecipeSummary } from '@/actions/nutrition-library'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

// ---------------------------------------------------------------------------
// Variant derivation
// ---------------------------------------------------------------------------

type FormVariant = 'recipe' | 'matched' | 'manual'

function deriveVariant(log: FoodLog): FormVariant {
  if (log.recipe_id != null) return 'recipe'
  if (
    log.match_source === 'nevo' ||
    log.match_source === 'off' ||
    log.match_source === 'custom_food' ||
    log.match_source === 'legacy_usda'
  )
    return 'matched'
  return 'manual'
}

// ---------------------------------------------------------------------------
// Numeric fields for manual variant
// ---------------------------------------------------------------------------

const NUMERIC_FIELDS: readonly (readonly [keyof ManualFoodLogInput, string])[] = [
  ['calories', 'Calories'],
  ['protein_g', 'Protein (g)'],
  ['carbs_g', 'Carbs (g)'],
  ['fat_g', 'Fat (g)'],
  ['fiber_g', 'Fiber (g)'],
  ['sugar_g', 'Sugar (g)'],
  ['sodium_mg', 'Sodium (mg)'],
  ['saturated_fat_g', 'Sat fat (g)'],
]

// ---------------------------------------------------------------------------
// Macro summary helpers
// ---------------------------------------------------------------------------

interface MacroSummaryProps {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

function MacroSummaryLine({ kcal, protein, carbs, fat }: MacroSummaryProps) {
  return (
    <p className="text-muted-foreground text-sm tabular-nums">
      {Math.round(kcal)} kcal · {Math.round(protein)}p / {Math.round(carbs)}c /{' '}
      {Math.round(fat)}f
    </p>
  )
}

// ---------------------------------------------------------------------------
// Shared metadata fields (date / meal / notes)
// ---------------------------------------------------------------------------

interface MetaFieldsProps {
  form: ReturnType<typeof useForm<ManualFoodLogInput>>
  meal: (v: string) => string | null
}

function MetaFields({ form, meal }: MetaFieldsProps) {
  return (
    <>
      {/* Stacked, not a 2-col grid: iOS renders the native date input wider
          than a half column, so side-by-side the Meal select overlapped it. */}
      <div className="space-y-1">
        <Label htmlFor="entry_date">Date</Label>
        <Input id="entry_date" type="date" {...form.register('entry_date')} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="meal_type">Meal</Label>
        <select
          id="meal_type"
          className="bg-background h-9 w-full rounded-md border px-2 text-sm"
          {...form.register('meal_type', { setValueAs: meal })}
        >
          <option value="">—</option>
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snack">Snack</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" {...form.register('notes')} />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FoodLogEditFormProps {
  log: FoodLog
  /** Called after a successful save so a dialog wrapper can close. */
  onSaved?: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FoodLogEditForm({ log, onSaved }: FoodLogEditFormProps) {
  const router = useRouter()
  const variant = deriveVariant(log)

  // Recipe summary (for recipe variant servings derivation)
  const [recipeSummary, setRecipeSummary] = useState<{
    id: string
    name: string
    total_grams: number
  } | null>(null)
  const [recipeSummaryLoading, setRecipeSummaryLoading] = useState(variant === 'recipe')

  // Servings state (recipe variant only) — refined once the summary loads.
  // `servings` is the last VALID value (drives macros + save); `servingsInput`
  // is the raw text so the field can be cleared / mid-edit ("0.", "") without
  // every keystroke being rejected. Reconciled on blur.
  const [servings, setServings] = useState(1)
  const [servingsInput, setServingsInput] = useState('1')

  useEffect(() => {
    if (variant !== 'recipe' || !log.recipe_id) {
      setRecipeSummaryLoading(false)
      return
    }
    let cancelled = false
    getRecipeSummary(log.recipe_id)
      .then((s) => {
        if (cancelled) return
        setRecipeSummary(s)
        setRecipeSummaryLoading(false)
        if (s && s.total_grams > 0 && log.grams && log.grams > 0) {
          // Quarter-serving snap keeps the value aligned with the input's
          // min/step so native form validation never rejects it.
          const derived = Math.max(0.25, Math.round((log.grams / s.total_grams) * 4) / 4)
          setServings(derived)
          setServingsInput(String(derived))
        }
      })
      .catch(() => {
        // Fetch failed: clear loading so the form stays usable. recipeSummary
        // stays null, keeping the servings input disabled — metadata-only
        // edits (date/meal/notes) still work.
        if (cancelled) return
        setRecipeSummaryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [variant, log.recipe_id, log.grams])

  const form = useForm<ManualFoodLogInput>({
    resolver: zodResolver(manualFoodLogSchema),
    defaultValues: {
      entry_date: log.entry_date.slice(0, 10),
      food_name: log.food_name,
      calories: log.calories,
      protein_g: log.protein_g,
      carbs_g: log.carbs_g,
      fat_g: log.fat_g,
      fiber_g: log.fiber_g,
      sugar_g: log.sugar_g,
      sodium_mg: log.sodium_mg,
      saturated_fat_g: log.saturated_fat_g,
      meal_type: log.meal_type ?? undefined,
      notes: log.notes ?? '',
      grams: log.grams,
    },
  })

  const num = (v: string) => (v === '' ? null : Number(v))
  const meal = (v: string) => (v === '' ? null : v)

  // Live macro preview for recipe variant
  const liveRecipeMacros = (() => {
    if (variant !== 'recipe') return null
    const totalGrams = recipeSummary?.total_grams ?? (log.grams ?? 0)
    if (totalGrams <= 0 || (log.grams ?? 0) <= 0) {
      return {
        kcal: (log.calories ?? 0) * servings,
        protein: (log.protein_g ?? 0) * servings,
        carbs: (log.carbs_g ?? 0) * servings,
        fat: (log.fat_g ?? 0) * servings,
      }
    }
    const per100g = {
      kcal: ((log.calories ?? 0) / (log.grams ?? 1)) * 100,
      protein: ((log.protein_g ?? 0) / (log.grams ?? 1)) * 100,
      carbs: ((log.carbs_g ?? 0) / (log.grams ?? 1)) * 100,
      fat: ((log.fat_g ?? 0) / (log.grams ?? 1)) * 100,
    }
    const scaledGrams = servings * totalGrams
    return {
      kcal: (per100g.kcal * scaledGrams) / 100,
      protein: (per100g.protein * scaledGrams) / 100,
      carbs: (per100g.carbs * scaledGrams) / 100,
      fat: (per100g.fat * scaledGrams) / 100,
    }
  })()

  // Live macro preview for matched variant (based on grams field)
  const watchedGrams = form.watch('grams')
  const liveMatchedMacros = (() => {
    if (variant !== 'matched') return null
    const g = typeof watchedGrams === 'number' && watchedGrams > 0 ? watchedGrams : log.grams ?? 0
    if (g <= 0 || (log.grams ?? 0) <= 0) {
      return { kcal: log.calories ?? 0, protein: log.protein_g ?? 0, carbs: log.carbs_g ?? 0, fat: log.fat_g ?? 0 }
    }
    const factor = g / (log.grams ?? 1)
    return {
      kcal: (log.calories ?? 0) * factor,
      protein: (log.protein_g ?? 0) * factor,
      carbs: (log.carbs_g ?? 0) * factor,
      fat: (log.fat_g ?? 0) * factor,
    }
  })()

  function afterSave(message: string) {
    toast.success(message)
    if (onSaved) {
      onSaved()
      router.refresh()
    } else {
      router.push('/nutrition')
    }
  }

  // updateFoodLog writes every macro column (omitted → null), and the grams
  // rescale derives per-100g from them — so variants without macro inputs
  // must re-send the row's stored macros. Sourcing them from `log` (not the
  // form spread) makes that explicit: the form only contributes the fields
  // it actually edits.
  const rowMacros = {
    calories: log.calories,
    protein_g: log.protein_g,
    carbs_g: log.carbs_g,
    fat_g: log.fat_g,
    fiber_g: log.fiber_g,
    sugar_g: log.sugar_g,
    sodium_mg: log.sodium_mg,
    saturated_fat_g: log.saturated_fat_g,
  }

  // ── Recipe variant submit ─────────────────────────────────────────────────
  async function onSubmitRecipe(values: ManualFoodLogInput) {
    // Editable fields only (date/meal/notes); name is read-only, macros come
    // from the row, grams omitted so it stays the per-100g derivation base.
    const r1 = await updateFoodLog(log.id, {
      entry_date: values.entry_date,
      food_name: log.food_name,
      meal_type: values.meal_type,
      notes: values.notes,
      ...rowMacros,
    })
    if (r1.error) {
      toast.error(r1.error)
      return
    }

    // Servings → grams rescale (only when summary loaded and servings changed)
    if (recipeSummary && recipeSummary.total_grams > 0) {
      const newGrams = servings * recipeSummary.total_grams
      const oldServings = log.grams && log.grams > 0 ? log.grams / recipeSummary.total_grams : 1
      if (Math.abs(servings - oldServings) > 0.001) {
        const r2 = await updateFoodLogGrams(log.id, newGrams)
        if (r2.error) {
          toast.error(r2.error)
          return
        }
        afterSave('Saved — macros rescaled for new servings')
        return
      }
    }

    afterSave('Saved')
  }

  // ── Matched / manual submit ───────────────────────────────────────────────
  async function onSubmitDefault(values: ManualFoodLogInput) {
    // matched renders no macro inputs → row macros; manual macros are
    // user-edited and authoritative → pass form values through.
    const payload: ManualFoodLogInput =
      variant === 'matched'
        ? {
            entry_date: values.entry_date,
            food_name: values.food_name,
            meal_type: values.meal_type,
            notes: values.notes,
            ...rowMacros,
            grams: values.grams,
          }
        : values

    const newGrams = values.grams ?? null
    const gramsChanged = newGrams !== (log.grams ?? null)

    if (gramsChanged && newGrams != null && log.match_source) {
      const r1 = await updateFoodLog(log.id, { ...payload, grams: undefined })
      if (r1.error) {
        toast.error(r1.error)
        return
      }
      const r2 = await updateFoodLogGrams(log.id, newGrams)
      if (r2.error) {
        toast.error(r2.error)
        return
      }
      afterSave('Saved — macros rescaled for new weight')
      return
    }

    const r = await updateFoodLog(log.id, payload)
    if (r.error) {
      toast.error(r.error)
      return
    }
    afterSave('Saved')
  }

  const onSubmit = variant === 'recipe' ? onSubmitRecipe : onSubmitDefault

  // ── Recipe variant UI ─────────────────────────────────────────────────────
  if (variant === 'recipe') {
    return (
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Read-only name */}
        <div className="space-y-1">
          <Label>Meal</Label>
          <p className="text-sm font-medium">{log.food_name}</p>
        </div>

        <MetaFields form={form} meal={meal} />

        {/* Servings */}
        <div className="space-y-1">
          <Label htmlFor="servings">Servings</Label>
          <Input
            id="servings"
            type="number"
            step="0.25"
            min="0.25"
            inputMode="decimal"
            value={servingsInput}
            disabled={recipeSummaryLoading || !recipeSummary}
            onChange={(e) => {
              // Accept whatever is typed (including "" and "0.") so the field
              // is editable; only valid positive values feed the live macros.
              setServingsInput(e.target.value)
              const v = parseFloat(e.target.value)
              if (!isNaN(v) && v > 0) setServings(Math.round(v * 100) / 100)
            }}
            onBlur={() => {
              // Settle on the last valid value, snapped to the quarter-serving
              // min/step grid (so native validation can't reject the field),
              // and restore it if the text was left empty/invalid.
              const v = parseFloat(servingsInput)
              const next = !isNaN(v) && v > 0 ? Math.max(0.25, Math.round(v * 4) / 4) : servings
              setServings(next)
              setServingsInput(String(next))
            }}
          />
          {recipeSummaryLoading && (
            <p className="text-muted-foreground text-xs">Loading recipe…</p>
          )}
        </div>

        {/* Live macro summary */}
        {liveRecipeMacros && <MacroSummaryLine {...liveRecipeMacros} />}

        {/* Library hint */}
        <p className="text-muted-foreground text-xs">
          To change what&apos;s in this meal, edit its ingredients in the Library.{' '}
          Edits there don&apos;t change already-logged entries.
        </p>
        {log.recipe_id && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push(`/nutrition/library?edit=recipe:${log.recipe_id}`)}
          >
            Edit meal ingredients
          </Button>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => (onSaved ? onSaved() : router.push('/nutrition'))}
          >
            Cancel
          </Button>
        </div>
      </form>
    )
  }

  // ── Matched variant UI ────────────────────────────────────────────────────
  if (variant === 'matched') {
    return (
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="food_name">Food</Label>
          <Input id="food_name" {...form.register('food_name')} />
        </div>

        <MetaFields form={form} meal={meal} />

        {/* Grams — rescales macros */}
        <div className="space-y-1">
          <Label htmlFor="grams">
            Grams{' '}
            <span className="text-muted-foreground text-xs">(changing rescales macros)</span>
          </Label>
          <Input
            id="grams"
            type="number"
            step="any"
            min="0"
            placeholder="e.g. 150"
            {...form.register('grams', { setValueAs: num })}
          />
        </div>

        {/* Live macro summary */}
        {liveMatchedMacros && <MacroSummaryLine {...liveMatchedMacros} />}

        {/* Edit custom food shortcut */}
        {log.custom_food_id && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push(`/nutrition/library?edit=custom:${log.custom_food_id}`)}
          >
            Edit custom food
          </Button>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => (onSaved ? onSaved() : router.push('/nutrition'))}
          >
            Cancel
          </Button>
        </div>
      </form>
    )
  }

  // ── Manual variant UI (full edit) ─────────────────────────────────────────
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="food_name">Food</Label>
        <Input id="food_name" {...form.register('food_name')} />
      </div>

      <MetaFields form={form} meal={meal} />

      <div className="grid grid-cols-2 gap-3">
        {/* Grams */}
        <div className="col-span-2 space-y-1">
          <Label htmlFor="grams">Grams</Label>
          <Input
            id="grams"
            type="number"
            step="any"
            min="0"
            placeholder="e.g. 150"
            {...form.register('grams', { setValueAs: num })}
          />
        </div>
        {NUMERIC_FIELDS.map(([key, label]) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={key}>{label}</Label>
            <Input id={key} type="number" step="any" {...form.register(key, { setValueAs: num })} />
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Save
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => (onSaved ? onSaved() : router.push('/nutrition'))}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
