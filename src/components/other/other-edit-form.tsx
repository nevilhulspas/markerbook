'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'

import { updateOtherTest } from '@/actions/other-tests'
import type {
  OtherTestExtract,
  OtherValueExtract,
} from '@/lib/validations/other-import'
import { OTHER_OUTCOME_LABELS, OTHER_OUTCOME_OPTIONS } from '@/lib/other/display'
import type { OtherTestOutcome, OtherTestWithValues } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'

// A reading row carries a stable client-only `_id` so React keys track row
// identity (not list position) — removing a middle row then keeps focus and
// transition state attached to the right inputs. Stripped before persisting.
type ReadingRow = OtherValueExtract & { _id: string }

const emptyValue = (): ReadingRow => ({
  _id: crypto.randomUUID(),
  label: '',
  value: null,
  unit: null,
  flag: null,
})

/**
 * Post-save edit form for an "other" test. Mirrors the review form in
 * other-import-client.tsx — same fields and reading rows — but prefilled from an
 * existing record and wired to updateOtherTest (mirrors rmr-form's edit flow).
 */
export function OtherEditForm({ test }: { test: OtherTestWithValues }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [fields, setFields] = useState<OtherTestExtract>({
    test_name: test.test_name,
    test_date: test.test_date,
    provider: test.provider,
    outcome: test.outcome,
    result_summary: test.result_summary,
    notes: test.notes,
  })
  const [values, setValues] = useState<ReadingRow[]>(
    test.values.map((v) => ({
      _id: v.id, // existing readings already have a stable DB id
      label: v.label,
      value: v.value,
      unit: v.unit,
      flag: v.flag,
    }))
  )

  const detailHref = `/other/${test.id}`

  function setField(key: keyof OtherTestExtract, raw: string) {
    setFields((t) => {
      if (key === 'outcome') return { ...t, outcome: raw as OtherTestOutcome }
      // Text fields: empty string clears optional ones to null (required ones keep '').
      const optional = key === 'provider' || key === 'result_summary' || key === 'notes'
      return { ...t, [key]: optional && raw === '' ? null : raw }
    })
  }

  function setValueField(i: number, key: keyof OtherValueExtract, raw: string) {
    setValues((rows) =>
      rows.map((row, j) => {
        if (j !== i) return row
        if (key === 'label') return { ...row, label: raw }
        return { ...row, [key]: raw === '' ? null : raw }
      })
    )
  }

  async function handleSave() {
    if (!fields.test_name.trim() || !fields.test_date) {
      toast.error('A test name and date are required.')
      return
    }
    setSaving(true)
    // Drop reading rows the user left without a label; strip the client-only _id.
    const cleanValues = values
      .filter((v) => v.label.trim() !== '')
      .map((v) => ({ label: v.label, value: v.value, unit: v.unit, flag: v.flag }))
    try {
      const { error } = await updateOtherTest(test.id, { test: fields, values: cleanValues })
      if (error) {
        toast.error(error)
        return
      }
      toast.success('Test updated')
      router.push(detailHref)
    } catch {
      // A thrown action (e.g. network failure) must still release the button.
      toast.error('Something went wrong while saving. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="space-y-4 pt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="test_name">Test name</Label>
            <Input
              id="test_name"
              value={fields.test_name}
              onChange={(e) => setField('test_name', e.target.value)}
              placeholder="e.g. SIBO breath test"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="test_date">Test date</Label>
            <Input
              id="test_date"
              type="date"
              value={fields.test_date}
              onChange={(e) => setField('test_date', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="provider">Provider</Label>
            <Input
              id="provider"
              value={fields.provider ?? ''}
              onChange={(e) => setField('provider', e.target.value)}
              placeholder="Lab / clinic"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="outcome">Result</Label>
            <Select value={fields.outcome} onValueChange={(v) => setField('outcome', v)}>
              <SelectTrigger id="outcome">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OTHER_OUTCOME_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {OTHER_OUTCOME_LABELS[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="result_summary">Result summary</Label>
            <Input
              id="result_summary"
              value={fields.result_summary ?? ''}
              onChange={(e) => setField('result_summary', e.target.value)}
              placeholder="One-line result"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={fields.notes ?? ''}
            onChange={(e) => setField('notes', e.target.value)}
            placeholder="Anything else worth keeping"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Readings (optional)</Label>
          {values.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No individual readings — fine for a simple yes/no test.
            </p>
          )}
          {values.map((v, i) => (
            <div key={v._id} className="grid grid-cols-12 gap-2">
              <Input
                aria-label="Label"
                className="col-span-5"
                value={v.label}
                onChange={(e) => setValueField(i, 'label', e.target.value)}
                placeholder="Label"
              />
              <Input
                aria-label="Value"
                className="col-span-3"
                value={v.value ?? ''}
                onChange={(e) => setValueField(i, 'value', e.target.value)}
                placeholder="Value"
              />
              <Input
                aria-label="Unit"
                className="col-span-2"
                value={v.unit ?? ''}
                onChange={(e) => setValueField(i, 'unit', e.target.value)}
                placeholder="Unit"
              />
              <Input
                aria-label="Flag"
                className="col-span-1"
                value={v.flag ?? ''}
                onChange={(e) => setValueField(i, 'flag', e.target.value)}
                placeholder="Flag"
              />
              <button
                type="button"
                aria-label="Remove reading"
                onClick={() => setValues((rows) => rows.filter((_, j) => j !== i))}
                className="col-span-1 flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setValues((rows) => [...rows, emptyValue()])}
          >
            <Plus className="size-4" />
            Add reading
          </Button>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
          <Button variant="outline" onClick={() => router.push(detailHref)}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
