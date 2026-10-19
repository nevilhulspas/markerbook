'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { logRecipe } from '@/actions/nutrition-logging'
import type { MealType } from '@/lib/database.types'

interface RecipeChip {
  id: string
  name: string
  total_grams: number
  useCount: number
}

interface RecipeChipsProps {
  recipes: RecipeChip[]
  defaultDate?: string | null
  meal?: MealType | null
}

function RecipePopover({
  recipe,
  defaultDate,
  meal,
}: {
  recipe: RecipeChip
  defaultDate?: string | null
  meal?: MealType | null
}) {
  const [servings, setServings] = useState(1)
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const router = useRouter()

  function handleLog() {
    start(async () => {
      const r = await logRecipe(recipe.id, servings, { date: defaultDate ?? null, meal: meal ?? null })
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success(`Logged: ${recipe.name}`)
      setOpen(false)
      setServings(1)
      router.refresh()
    })
  }

  const totalGrams = Math.round(servings * recipe.total_grams)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          {recipe.name}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 space-y-3 p-3" align="start">
        <p className="text-sm font-medium">{recipe.name}</p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            aria-label="Decrease servings"
            disabled={servings <= 0.5}
            onClick={() => setServings((s) => Math.max(0.5, Math.round((s - 0.5) * 10) / 10))}
          >
            −
          </Button>
          <span className="min-w-[2.5rem] text-center text-sm tabular-nums">
            {servings}×
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            aria-label="Increase servings"
            onClick={() => setServings((s) => Math.round((s + 0.5) * 10) / 10)}
          >
            +
          </Button>
          <span className="text-muted-foreground text-xs tabular-nums">{totalGrams}g</span>
        </div>
        <Button size="sm" className="w-full" onClick={handleLog} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : 'Log'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          onClick={() => router.push(`/nutrition/library?edit=recipe:${recipe.id}`)}
        >
          Edit meal
        </Button>
      </PopoverContent>
    </Popover>
  )
}

export function RecipeChips({ recipes, defaultDate, meal }: RecipeChipsProps) {
  if (recipes.length === 0) return null
  const visible = recipes.slice(0, 5)
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((r) => (
        <RecipePopover key={r.id} recipe={r} defaultDate={defaultDate} meal={meal} />
      ))}
    </div>
  )
}
