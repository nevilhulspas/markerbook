'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'

import {
  addBiomarkerToList,
  addLabTestToList,
  addCategoryToList,
  type NextToTestEntry,
} from '@/actions/next-to-test/entries'
import type { NextToTestType } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { NextToTestList } from '@/lib/database.types'

type CategoryTarget = {
  kind: 'category'
  testType: Exclude<NextToTestType, 'blood_biomarker' | 'blood_lab_test'>
  // Optional user-facing label override (e.g. "DEXA at HumanFitness").
  // Required for testType='other' — the form enforces this with a custom
  // validation message before submitting.
  customName?: string
}

interface Props {
  target:
    | { kind: 'biomarker'; biomarkerId: string }
    | { kind: 'lab_test'; labTestId: string }
    | CategoryTarget
  lists: NextToTestList[]
  defaultListId?: string
  onAdded?: (entry: NextToTestEntry) => void
  onClose?: () => void
}

export function AddNextToTestForm({
  target,
  lists,
  defaultListId,
  onAdded,
  onClose,
}: Props) {
  const [listId, setListId] = useState(defaultListId ?? lists[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!listId) {
      setError('Please pick a list.')
      return
    }
    setError(null)
    startTransition(async () => {
      const args = {
        listId,
        note: note.trim() || undefined,
        dueDate: dueDate || undefined,
      }
      const r =
        target.kind === 'biomarker'
          ? await addBiomarkerToList({ ...args, biomarkerId: target.biomarkerId })
          : target.kind === 'lab_test'
            ? await addLabTestToList({ ...args, labTestId: target.labTestId })
            : await addCategoryToList({
                ...args,
                testType: target.testType,
                customName: target.customName,
              })
      if ('error' in r) {
        setError(r.error === 'duplicate' ? 'Already on this list.' : r.error)
        return
      }
      onAdded?.(r.entry)
      onClose?.()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="ntt-list">List</Label>
        <Select value={listId} onValueChange={setListId}>
          <SelectTrigger id="ntt-list">
            <SelectValue placeholder="Pick a list…" />
          </SelectTrigger>
          <SelectContent>
            {lists.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ntt-note">Note (optional)</Label>
        <Input
          id="ntt-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. order at next visit"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ntt-due">Due date (optional)</Label>
        <Input
          id="ntt-due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        {onClose && (
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={pending || !listId}>
          {pending && <Loader2 className="mr-1 size-4 animate-spin" />}
          Add to list
        </Button>
      </div>
    </form>
  )
}
