'use client'

import { useState, useTransition, useCallback, useEffect, useRef } from 'react'

import { Input } from '@/components/ui/input'
import { searchFoods } from '@/actions/nutrition-library'
import type { SearchFoodsResult } from '@/actions/nutrition-library'
import type { Macros100 } from '@/lib/nutrition/macros'

export interface IngredientPickResult {
  label: string
  nevo_code?: string
  off_barcode?: string
  custom_food_id?: string
  per100g: Macros100
  default_grams?: number
}

interface IngredientSearchProps {
  onPick: (item: IngredientPickResult) => void
}

export function IngredientSearch({ onPick }: IngredientSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchFoodsResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Epoch guard: only the latest search may write results — a slower earlier
  // response (or one resolving after a clear/pick) is discarded.
  const epochRef = useRef(0)

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  const handleChange = useCallback((value: string) => {
    setQuery(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    const epoch = ++epochRef.current
    if (value.length < 2) {
      setResults(null)
      return
    }
    timerRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await searchFoods(value)
        if (epochRef.current === epoch) setResults(res)
      })
    }, 300)
  }, [])

  function pick(item: IngredientPickResult) {
    onPick(item)
    if (timerRef.current) clearTimeout(timerRef.current)
    epochRef.current++
    setQuery('')
    setResults(null)
  }

  const hasResults =
    results &&
    (results.library.length > 0 || results.nevo.length > 0 || results.off.length > 0)

  return (
    <div className="space-y-2">
      <Input
        placeholder="Search NEVO, Open Food Facts or your foods…"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
      />
      {isPending && query.length >= 2 && (
        <p className="text-xs text-muted-foreground">Searching…</p>
      )}
      {!isPending && results && !hasResults && query.length >= 2 && (
        <p className="text-xs text-muted-foreground">No matches</p>
      )}
      {!isPending && hasResults && (
        <div className="rounded-md border divide-y max-h-80 overflow-y-auto overscroll-contain">
          {results.library.length > 0 && (
            <div>
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground bg-muted/40">
                Your foods
              </p>
              {results.library.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex justify-between"
                  onClick={() =>
                    pick({
                      label: item.name,
                      ...(item.kind === 'custom_food'
                        ? { custom_food_id: item.id }
                        : {}),
                      per100g: item.per100g,
                      default_grams: item.default_grams,
                    })
                  }
                >
                  <span>{item.name}</span>
                  <span className="text-muted-foreground">
                    {Math.round(item.per100g.kcal)} kcal/100g
                  </span>
                </button>
              ))}
            </div>
          )}
          {results.nevo.length > 0 && (
            <div>
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground bg-muted/40">
                NEVO
              </p>
              {results.nevo.map((item) => (
                <button
                  key={item.nevo_code}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex justify-between"
                  onClick={() =>
                    pick({
                      label: item.name_nl,
                      nevo_code: item.nevo_code,
                      per100g: item.per100g,
                    })
                  }
                >
                  <span>{item.name_nl}</span>
                  <span className="text-muted-foreground">
                    {Math.round(item.per100g.kcal)} kcal/100g
                  </span>
                </button>
              ))}
            </div>
          )}
          {results.off.length > 0 && (
            <div>
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground bg-muted/40">
                Open Food Facts
              </p>
              {results.off.map((item) => (
                <button
                  key={item.barcode}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex justify-between"
                  onClick={() =>
                    pick({
                      label: item.name,
                      off_barcode: item.barcode,
                      per100g: item.per100g,
                    })
                  }
                >
                  <span>{item.name}</span>
                  <span className="text-muted-foreground">
                    {Math.round(item.per100g.kcal)} kcal/100g
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
