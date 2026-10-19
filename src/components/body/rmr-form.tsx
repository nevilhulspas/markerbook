'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { saveRmrTest } from '@/actions/rmr-import'
import { updateRmrTest } from '@/actions/rmr'
import type { RmrTestExtract } from '@/lib/validations/rmr-import'
import type { RmrTest } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { appTodayISO } from '@/lib/dates/today'

// Optional numeric columns, edited as strings and coerced back ('' → null).
const NUM_FIELDS: { key: keyof RmrTestExtract; label: string }[] = [
  { key: 'predicted_rmr_kcal', label: 'Predicted RMR (kcal/day)' },
  { key: 'rer', label: 'RER' },
  { key: 'fuel_carb_pct', label: 'Fuel — carbs %' },
  { key: 'fuel_fat_pct', label: 'Fuel — fat %' },
]

function toToday(): string {
  return appTodayISO()
}

/**
 * Controlled add/edit form over the rmr_tests fields. `test` present → edit
 * (updateRmrTest); absent → new (saveRmrTest, source 'manual'). test_date and
 * rmr_kcal are required; everything else is empty-safe (blank → null).
 */
export function RmrForm({ test }: { test?: RmrTest }) {
  const router = useRouter()
  const editing = test != null
  const [saving, setSaving] = useState(false)

  const [testDate, setTestDate] = useState(test?.test_date ?? toToday())
  const [provider, setProvider] = useState(test?.provider ?? '')
  const [rmrKcal, setRmrKcal] = useState(test?.rmr_kcal == null ? '' : String(test.rmr_kcal))
  const [notes, setNotes] = useState(test?.notes ?? '')
  const [nums, setNums] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const f of NUM_FIELDS) {
      const v = test?.[f.key as keyof RmrTest]
      init[f.key as string] = v == null ? '' : String(v)
    }
    return init
  })

  function backHref(): string {
    return editing ? `/body/rmr/${test!.id}` : '/body'
  }

  async function handleSave() {
    if (!testDate) {
      toast.error('Test date is required.')
      return
    }
    const rmr = rmrKcal === '' ? NaN : Number(rmrKcal)
    if (!Number.isFinite(rmr)) {
      toast.error('Measured RMR (kcal/day) is required.')
      return
    }

    const optional: Pick<
      RmrTestExtract,
      'predicted_rmr_kcal' | 'rer' | 'fuel_carb_pct' | 'fuel_fat_pct'
    > = {
      predicted_rmr_kcal: null,
      rer: null,
      fuel_carb_pct: null,
      fuel_fat_pct: null,
    }
    for (const f of NUM_FIELDS) {
      const raw = nums[f.key as string]
      const n = raw === '' ? null : Number(raw)
      optional[f.key as keyof typeof optional] = Number.isFinite(n as number) ? n : null
    }

    setSaving(true)

    if (editing) {
      const { error } = await updateRmrTest(test!.id, {
        test_date: testDate,
        provider: provider || null,
        rmr_kcal: rmr,
        ...optional,
        notes: notes || null,
      })
      setSaving(false)
      if (error) {
        toast.error(error)
        return
      }
      toast.success('RMR test updated')
      router.push(`/body/rmr/${test!.id}`)
      return
    }

    const result = await saveRmrTest({
      extraction: {
        test: {
          test_date: testDate,
          provider: provider || null,
          rmr_kcal: rmr,
          ...optional,
        },
      },
      source: 'manual',
    })
    if (!result.success) {
      setSaving(false)
      toast.error(result.error)
      return
    }
    // Notes aren't part of the extraction shape; persist them in a follow-up
    // patch so manual entries can carry a note. Surface a failure (the test is
    // already saved) instead of silently dropping the note.
    if (notes) {
      const { error } = await updateRmrTest(result.testId, { notes })
      if (error) {
        toast.error(`Test saved, but notes could not be saved: ${error}`)
      } else {
        toast.success('RMR test saved')
      }
    } else {
      toast.success('RMR test saved')
    }
    router.push(`/body/rmr/${result.testId}`)
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="space-y-4 pt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="test_date">Test date</Label>
            <Input
              id="test_date"
              type="date"
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="provider">Provider</Label>
            <Input
              id="provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rmr_kcal">Measured RMR (kcal/day)</Label>
            <Input
              id="rmr_kcal"
              inputMode="decimal"
              value={rmrKcal}
              onChange={(e) => setRmrKcal(e.target.value)}
            />
          </div>
          {NUM_FIELDS.map((f) => (
            <div key={String(f.key)} className="space-y-1.5">
              <Label htmlFor={String(f.key)}>{f.label}</Label>
              <Input
                id={String(f.key)}
                inputMode="decimal"
                value={nums[f.key as string] ?? ''}
                onChange={(e) =>
                  setNums((s) => ({ ...s, [f.key as string]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {editing ? 'Save changes' : 'Save test'}
          </Button>
          <Button variant="outline" onClick={() => router.push(backHref())}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
