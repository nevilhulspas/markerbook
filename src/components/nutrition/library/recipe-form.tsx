'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { XIcon } from 'lucide-react'

import { saveRecipe, getRecipeLogStats } from '@/actions/nutrition-library'
import type { RecipeWithIngredients } from '@/actions/nutrition-library'
import type { RecipeInput } from '@/lib/validations/nutrition'
import { scaleTo, type Macros100 } from '@/lib/nutrition/macros'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { IngredientSearch } from './ingredient-search'
import type { IngredientPickResult } from './ingredient-search'

interface IngredientRow {
  key: string
  label: string
  nevo_code?: string
  off_barcode?: string
  custom_food_id?: string
  raw_name: string
  grams: number
  per100g: Macros100
}

/** Today's date in the USER'S timezone as YYYY-MM-DD — toISOString() would give
 *  the UTC date, which is yesterday for UTC+ users between local and UTC midnight. */
function localToday(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function buildFromExisting(r: RecipeWithIngredients): IngredientRow[] {
  return r.ingredients.map((ing, i) => ({
    key: `existing-${i}`,
    label: ing.raw_name ?? `Ingredient ${i + 1}`,
    nevo_code: ing.nevo_code ?? undefined,
    off_barcode: ing.off_barcode ?? undefined,
    custom_food_id: ing.custom_food_id ?? undefined,
    raw_name: ing.raw_name ?? `Ingredient ${i + 1}`,
    grams: ing.grams,
    per100g: {
      kcal: ing.kcal_per_100g ?? 0,
      protein: ing.protein_per_100g ?? 0,
      carbs: ing.carbs_per_100g ?? 0,
      fat: ing.fat_per_100g ?? 0,
      fiber: ing.fiber_per_100g ?? 0,
      sugar: ing.sugar_per_100g ?? 0,
      sodium_mg: ing.sodium_mg_per_100g ?? 0,
      sat_fat: ing.sat_fat_per_100g ?? 0,
    },
  }))
}

function sumIngredients(rows: IngredientRow[]) {
  let kcal = 0
  let protein = 0
  let carbs = 0
  let fat = 0
  let grams = 0
  for (const row of rows) {
    const scaled = scaleTo(row.per100g, row.grams)
    kcal += scaled.kcal
    protein += scaled.protein
    carbs += scaled.carbs
    fat += scaled.fat
    grams += row.grams
  }
  return { kcal, protein, carbs, fat, grams }
}

interface RecipeFormProps {
  existing?: RecipeWithIngredients
  onClose: () => void
}

export function RecipeForm({ existing, onClose }: RecipeFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(existing?.name ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [nameError, setNameError] = useState('')
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    existing ? buildFromExisting(existing) : []
  )
  const [ingredientsError, setIngredientsError] = useState('')

  // AUT-955: retro confirm dialog — set when the edited meal has logged entries.
  const [retroPrompt, setRetroPrompt] = useState<{ count: number } | null>(null)
  const [applyRetro, setApplyRetro] = useState(false)
  const [retroSince, setRetroSince] = useState('')

  function addIngredient(picked: IngredientPickResult) {
    const row: IngredientRow = {
      key: `${Date.now()}-${Math.random()}`,
      label: picked.label,
      nevo_code: picked.nevo_code,
      off_barcode: picked.off_barcode,
      custom_food_id: picked.custom_food_id,
      raw_name: picked.label,
      grams: picked.default_grams ?? 100,
      per100g: picked.per100g,
    }
    setIngredients((prev) => [...prev, row])
    setIngredientsError('')
  }

  function removeIngredient(key: string) {
    setIngredients((prev) => prev.filter((r) => r.key !== key))
  }

  function updateGrams(key: string, value: string) {
    const g = value === '' ? 0 : Number(value)
    setIngredients((prev) => prev.map((r) => (r.key === key ? { ...r, grams: g } : r)))
  }

  function buildInput(): RecipeInput {
    return {
      id: existing?.id,
      name: name.trim(),
      notes: notes.trim() || null,
      ingredients: ingredients.map((row) => ({
        nevo_code: row.nevo_code ?? null,
        off_barcode: row.off_barcode ?? null,
        custom_food_id: row.custom_food_id ?? null,
        raw_name: row.raw_name,
        grams: row.grams,
        kcal_per_100g: row.per100g.kcal,
        protein_per_100g: row.per100g.protein,
        carbs_per_100g: row.per100g.carbs,
        fat_per_100g: row.per100g.fat,
        fiber_per_100g: row.per100g.fiber,
        sugar_per_100g: row.per100g.sugar,
        sodium_mg_per_100g: row.per100g.sodium_mg,
        sat_fat_per_100g: row.per100g.sat_fat,
      })),
    }
  }

  async function saveMeal(retro: { since: string } | null) {
    const res = await saveRecipe(buildInput(), retro ? { retro } : undefined)
    if (res.error) {
      toast.error(res.error)
      return
    }
    if (res.updatedLogs) {
      const noun = res.updatedLogs === 1 ? 'entry' : 'entries'
      toast.success(`Meal updated · ${res.updatedLogs} logged ${noun} updated`)
    } else {
      toast.success(existing ? 'Meal updated' : 'Meal saved')
    }
    setRetroPrompt(null)
    router.refresh()
    onClose()
  }

  function performSave(retro: { since: string } | null) {
    startTransition(() => saveMeal(retro))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    let valid = true
    if (!name.trim()) {
      setNameError('Name is required')
      valid = false
    } else {
      setNameError('')
    }
    if (ingredients.length === 0) {
      setIngredientsError('At least one ingredient is required')
      valid = false
    } else {
      setIngredientsError('')
    }
    if (!valid) return

    if (!existing) {
      performSave(null)
      return
    }

    // Editing an existing meal: only prompt when it has logged entries.
    startTransition(async () => {
      let stats: { count: number; earliestDate: string | null }
      try {
        stats = await getRecipeLogStats(existing.id)
      } catch {
        toast.error('Could not check logged entries. Please try again.')
        return
      }
      if (stats.count === 0) {
        // Stay inside this transition (no nested startTransition) so isPending
        // doesn't flicker between the stats fetch and the save.
        await saveMeal(null)
        return
      }
      setApplyRetro(false)
      setRetroSince(stats.earliestDate ?? localToday())
      setRetroPrompt({ count: stats.count })
    })
  }

  const totals = sumIngredients(ingredients)

  return (
    // min-w-0: the form is a grid item of DialogContent — without it the nowrap
    // ingredient labels set the grid track's min-content width and the whole
    // form overflows the dialog horizontally.
    <form onSubmit={handleSubmit} className="min-w-0 space-y-4">
      <div className="space-y-1">
        <Label htmlFor="rf-name">Name *</Label>
        <Input
          id="rf-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="rf-notes">Notes</Label>
        <Input
          id="rf-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <p className="text-sm font-medium">Ingredients</p>
        {ingredients.length > 0 && (
          <div className="space-y-2">
            {ingredients.map((row) => {
              const rowKcal = scaleTo(row.per100g, row.grams).kcal
              return (
                <div key={row.key} className="flex items-center gap-2">
                  {/* min-w-0 lets the flex child shrink so truncate can kick in */}
                  <span className="flex-1 min-w-0 text-sm truncate" title={row.label}>
                    {row.label}
                  </span>
                  <Input
                    type="number"
                    step="any"
                    min="1"
                    value={row.grams}
                    onChange={(e) => updateGrams(row.key, e.target.value)}
                    className="w-20"
                    aria-label={`Grams for ${row.label}`}
                  />
                  <span className="text-xs text-muted-foreground w-16 text-right">
                    {Math.round(rowKcal)} kcal
                  </span>
                  <button
                    type="button"
                    onClick={() => removeIngredient(row.key)}
                    aria-label={`Remove ${row.label}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <XIcon className="size-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {ingredientsError && (
          <p className="text-xs text-destructive">{ingredientsError}</p>
        )}
        <IngredientSearch onPick={addIngredient} />
      </div>

      {ingredients.length > 0 && (
        <>
          <Separator />
          <div className="text-sm text-muted-foreground flex gap-4 flex-wrap">
            <span>
              <span className="font-medium text-foreground">{Math.round(totals.grams)}g</span> total
            </span>
            <span>
              <span className="font-medium text-foreground">{Math.round(totals.kcal)}</span> kcal
            </span>
            <span>
              P <span className="font-medium text-foreground">{Math.round(totals.protein)}g</span>
            </span>
            <span>
              C <span className="font-medium text-foreground">{Math.round(totals.carbs)}g</span>
            </span>
            <span>
              F <span className="font-medium text-foreground">{Math.round(totals.fat)}g</span>
            </span>
          </div>
        </>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>

      {retroPrompt !== null && (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) setRetroPrompt(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apply changes to logged entries?</AlertDialogTitle>
              <AlertDialogDescription>
                This meal appears in {retroPrompt?.count} logged{' '}
                {retroPrompt?.count === 1 ? 'entry' : 'entries'}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3">
              <RadioGroup
                value={applyRetro ? 'retro' : 'forward'}
                onValueChange={(v) => setApplyRetro(v === 'retro')}
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="forward" id="retro-forward" />
                  <Label htmlFor="retro-forward" className="text-sm font-normal">
                    From now on — logged entries stay as they are
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="retro" id="retro-retro" />
                  <Label htmlFor="retro-retro" className="text-sm font-normal">
                    Also update logged entries
                  </Label>
                </div>
              </RadioGroup>
              {applyRetro && (
                <div className="flex items-center gap-2 pl-6">
                  <Label htmlFor="retro-since" className="text-sm text-muted-foreground">
                    since
                  </Label>
                  <Input
                    id="retro-since"
                    type="date"
                    value={retroSince}
                    max={localToday()}
                    onChange={(e) => setRetroSince(e.target.value)}
                    className="w-40"
                  />
                </div>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setRetroPrompt(null)}>
                Cancel
              </AlertDialogCancel>
              <Button
                type="button"
                disabled={isPending || (applyRetro && !retroSince)}
                onClick={() =>
                  performSave(
                    applyRetro
                      ? {
                          // Convert the user's chosen date to local midnight, Z-normalized to
                          // satisfy the Zod z.string().datetime() check in saveRecipe.
                          since: new Date(`${retroSince}T00:00:00`).toISOString(),
                        }
                      : null
                  )
                }
              >
                {isPending ? 'Saving…' : 'Save'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </form>
  )
}
