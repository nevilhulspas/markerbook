'use client'

import { Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type IntakeMomentValue = { time: string; amount: string | null }

/** Presets for the three times the user reaches for most. */
const PRESETS: { label: string; time: string }[] = [
  { label: 'Morning', time: '08:00' },
  { label: 'Afternoon', time: '13:00' },
  { label: 'Evening', time: '22:00' },
]

interface IntakeMomentsFieldProps {
  value: IntakeMomentValue[]
  onChange: (next: IntakeMomentValue[]) => void
}

/** Matches the cap in `intakesSchema`. */
const MAX_MOMENTS = 12

/**
 * The first time not already listed: a free preset if there is one, else the
 * first free whole hour. With at most 12 moments and 24 hours there is always
 * one, so "Add moment" can never become a button that does nothing.
 */
function firstFreeTime(taken: Set<string>): string | null {
  const preset = PRESETS.find((p) => !taken.has(p.time))
  if (preset) return preset.time
  for (let hour = 0; hour < 24; hour++) {
    const time = `${String(hour).padStart(2, '0')}:00`
    if (!taken.has(time)) return time
  }
  return null
}

export function IntakeMomentsField({
  value,
  onChange,
}: IntakeMomentsFieldProps) {
  const taken = new Set(value.map((v) => v.time))
  const atCap = value.length >= MAX_MOMENTS

  // New moments are appended rather than sorted into place: re-sorting shifts
  // every later row's index, which moves focus out from under whoever is
  // typing. The saved order does not matter — reads and the grouped view sort
  // by time themselves.
  function addPreset(time: string) {
    // Adding a time that is already listed would trip the duplicate-time rule,
    // so a second click on the same preset is deliberately a no-op.
    if (taken.has(time) || atCap) return
    onChange([...value, { time, amount: null }])
  }

  function addBlank() {
    if (atCap) return
    const time = firstFreeTime(taken)
    if (!time) return
    onChange([...value, { time, amount: null }])
  }

  function update(index: number, patch: Partial<IntakeMomentValue>) {
    onChange(value.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <Label>Intake moments</Label>
      <p className="text-xs text-muted-foreground">
        When you take it, and how much each time. Leave empty if the time does
        not matter.
      </p>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.time}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addPreset(p.time)}
            disabled={taken.has(p.time) || atCap}
          >
            {p.label} {p.time}
          </Button>
        ))}
      </div>

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((moment, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                type="time"
                value={moment.time}
                onChange={(e) => update(index, { time: e.target.value })}
                aria-label={`Intake time ${index + 1}`}
                className="w-32"
              />
              <Input
                value={moment.amount ?? ''}
                onChange={(e) =>
                  update(index, { amount: e.target.value || null })
                }
                placeholder="1 capsule"
                aria-label={`Amount at ${moment.time}`}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => remove(index)}
                aria-label={`Remove intake at ${moment.time}`}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={addBlank}
        disabled={atCap}
      >
        <Plus className="size-4" />
        Add moment
      </Button>
      {atCap && (
        <p className="text-xs text-muted-foreground">
          That is the maximum of {MAX_MOMENTS} intake moments.
        </p>
      )}
    </div>
  )
}
