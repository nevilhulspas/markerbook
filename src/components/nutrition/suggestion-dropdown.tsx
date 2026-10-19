'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'

import { logRecipe, logCustomFood } from '@/actions/nutrition-logging'
import type { MealType } from '@/lib/database.types'

export interface LibrarySuggestion {
  kind: 'recipe' | 'custom_food'
  id: string
  name: string
  grams: number
}

interface SuggestionDropdownProps {
  query: string
  suggestions: LibrarySuggestion[]
  meal?: MealType | null
  defaultDate?: string | null
  onLogged: () => void
  onClose: () => void
}

function normalize(s: string): string {
  return s.toLowerCase().trim()
}

export function SuggestionDropdown({
  query,
  suggestions,
  meal,
  defaultDate,
  onLogged,
  onClose,
}: SuggestionDropdownProps) {
  const [isPending, startTransition] = useTransition()

  const q = normalize(query)
  // Mirror the parent's open condition (≥2 chars): an empty/short query matches
  // every name via includes(''), so a stale-open parent would show the full list.
  if (q.length < 2) return null
  const matches = suggestions
    .filter((s) => normalize(s.name).includes(q))
    .slice(0, 5)

  if (matches.length === 0) return null

  function handleLog(item: LibrarySuggestion) {
    if (isPending) return
    startTransition(async () => {
      const opts = { meal: meal ?? null, date: defaultDate ?? null }
      const res =
        item.kind === 'recipe'
          ? await logRecipe(item.id, 1, opts)
          : await logCustomFood(item.id, opts)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`Logged: ${item.name}`)
      onLogged()
    })
  }

  return (
    <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-md">
      {matches.map((item) => (
        <button
          key={item.id}
          type="button"
          className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 first:rounded-t-md last:rounded-b-md"
          onClick={() => {
            onClose()
            handleLog(item)
          }}
          disabled={isPending}
        >
          <span className="truncate">{item.name}</span>
          <span className="ml-2 flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="rounded-sm bg-muted px-1 py-0.5 capitalize">
              {item.kind === 'recipe' ? 'meal' : 'food'}
            </span>
            <span>{item.grams}g</span>
          </span>
        </button>
      ))}
    </div>
  )
}
