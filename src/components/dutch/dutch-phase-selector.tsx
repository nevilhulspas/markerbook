'use client'

import type { MenstrualPhase } from '@/lib/database.types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DutchPhaseSelectorProps {
  phase: MenstrualPhase | null
  cycleDay: number | null
  onPhaseChange: (phase: MenstrualPhase | null) => void
  onCycleDayChange: (day: number | null) => void
}

const PHASE_OPTIONS: { value: MenstrualPhase; label: string }[] = [
  { value: 'follicular', label: 'Follicular' },
  { value: 'luteal', label: 'Luteal' },
  { value: 'postmenopausal', label: 'Postmenopausal' },
  { value: 'oral_progesterone', label: 'Oral Progesterone' },
  { value: 'oral_contraceptive', label: 'Oral Contraceptive' },
  { value: 'male', label: 'Male' },
  { value: 'unknown', label: 'Unknown' },
]

const NOT_SPECIFIED = '__not_specified__'

export function DutchPhaseSelector({
  phase,
  cycleDay,
  onPhaseChange,
  onCycleDayChange,
}: DutchPhaseSelectorProps) {
  const showCycleDay = phase === 'follicular' || phase === 'luteal'

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="menstrual-phase" className="text-xs">
            Menstrual Phase
          </Label>
          <Select
            value={phase ?? NOT_SPECIFIED}
            onValueChange={(val) =>
              onPhaseChange(
                val === NOT_SPECIFIED ? null : (val as MenstrualPhase)
              )
            }
          >
            <SelectTrigger id="menstrual-phase" className="w-full">
              <SelectValue placeholder="Not specified" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NOT_SPECIFIED}>Not specified</SelectItem>
              {PHASE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showCycleDay && (
          <div className="space-y-1">
            <Label htmlFor="cycle-day" className="text-xs">
              Cycle Day
            </Label>
            <Input
              id="cycle-day"
              type="number"
              min={1}
              max={60}
              placeholder="e.g. 14"
              value={cycleDay ?? ''}
              onChange={(e) => {
                const val = e.target.value
                if (val === '') {
                  onCycleDayChange(null)
                } else {
                  const parsed = parseInt(val, 10)
                  if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 60) {
                    onCycleDayChange(parsed)
                  }
                }
              }}
            />
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Menstrual phase affects reference range interpretation
      </p>
    </div>
  )
}
