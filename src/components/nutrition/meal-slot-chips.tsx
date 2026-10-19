'use client'

import { cn } from '@/lib/utils'
import type { MealType } from '@/lib/database.types'

const SLOTS: { value: MealType | null; label: string }[] = [
  { value: null, label: 'Auto' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'snack', label: 'Snack' },
  { value: 'dinner', label: 'Dinner' },
]

interface MealSlotChipsProps {
  value: MealType | null
  onChange: (v: MealType | null) => void
}

export function MealSlotChips({ value, onChange }: MealSlotChipsProps) {
  return (
    <div className="inline-flex flex-wrap gap-1">
      {SLOTS.map((slot) => (
        <button
          key={slot.label}
          type="button"
          onClick={() => onChange(slot.value)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            value === slot.value
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          )}
        >
          {slot.label}
        </button>
      ))}
    </div>
  )
}
