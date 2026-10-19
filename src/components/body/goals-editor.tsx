'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { saveGoal } from '@/actions/dexa'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { BodyGoal, BodyMetricKey } from '@/lib/database.types'

const GOAL_FIELDS: { metric: BodyMetricKey; label: string; unit: string }[] = [
  { metric: 'body_fat_pct', label: 'Body fat', unit: '%' },
  { metric: 'lean_mass_kg', label: 'Lean mass', unit: 'kg' },
  { metric: 'total_mass_kg', label: 'Total mass', unit: 'kg' },
  { metric: 'visceral_fat_g', label: 'Visceral fat', unit: 'g' },
  { metric: 'ffmi', label: 'FFMI', unit: 'kg/m²' },
  { metric: 'almi', label: 'ALMI', unit: 'kg/m²' },
  { metric: 'bone_t_score', label: 'Bone T-score', unit: '' },
]

export function GoalsEditor({ goals }: { goals: BodyGoal[] }) {
  const router = useRouter()
  const initial: Record<string, string> = {}
  for (const g of goals) initial[g.metric] = String(g.target_value)
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [saving, setSaving] = useState<string | null>(null)

  async function handleSave(metric: BodyMetricKey) {
    const raw = values[metric]
    const n = Number(raw)
    if (raw == null || raw === '' || !Number.isFinite(n)) {
      toast.error('Enter a number')
      return
    }
    setSaving(metric)
    const { error } = await saveGoal(metric, n)
    setSaving(null)
    if (error) toast.error(error)
    else {
      toast.success('Goal saved')
      router.refresh()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Targets</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {GOAL_FIELDS.map((f) => (
          <div key={f.metric} className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor={`goal-${f.metric}`} className="text-xs">
                {f.label}{f.unit && ` (${f.unit})`}
              </Label>
              <Input
                id={`goal-${f.metric}`}
                inputMode="decimal"
                value={values[f.metric] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.metric]: e.target.value }))}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSave(f.metric)}
              disabled={saving === f.metric}
            >
              {saving === f.metric ? <Loader2 className="size-4 animate-spin" /> : 'Set'}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
