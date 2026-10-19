'use client'

// AUT-854: per-user list of previous/ongoing medical conditions. Each entry
// has an optional start/end date pair (null end_date = ongoing) and optional
// free-text notes. Add via inline dialog, edit/delete per row.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  addMedicalCondition,
  updateMedicalCondition,
  deleteMedicalCondition,
} from '@/actions/medical-conditions'
import type { MedicalCondition } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface ConditionDialogProps {
  initial?: MedicalCondition | null
  trigger: React.ReactNode
}

function ConditionDialog({ initial, trigger }: ConditionDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(initial?.condition_name ?? '')
  const [startDate, setStartDate] = useState(initial?.start_date ?? '')
  const [endDate, setEndDate] = useState(initial?.end_date ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Condition name is required')
      return
    }
    if (startDate && endDate && endDate < startDate) {
      setError('End date must be on or after start date')
      return
    }

    startTransition(async () => {
      const payload = {
        condition_name: name.trim(),
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        notes: notes.trim() || undefined,
      }
      const res = initial
        ? await updateMedicalCondition(initial.id, payload)
        : await addMedicalCondition(payload)

      if (res.ok) {
        toast.success(initial ? 'Condition updated' : 'Condition added')
        setOpen(false)
        if (!initial) {
          // Reset for next add.
          setName('')
          setStartDate('')
          setEndDate('')
          setNotes('')
        }
        router.refresh()
      } else if (res.kind === 'invalid') {
        setError(res.details.join(', '))
      } else if (res.kind === 'unauthorized') {
        setError('You need to be signed in')
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initial ? 'Edit condition' : 'Add a previous condition'}
          </DialogTitle>
          <DialogDescription>
            Leave the end date empty if it&apos;s ongoing.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="condition_name">Condition</Label>
            <Input
              id="condition_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hypothyroidism"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start date</Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End date</Label>
              <Input
                id="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything relevant — meds taken, current status, etc."
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {initial ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteConditionButton({ id }: { id: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  function handleDelete() {
    startTransition(async () => {
      const res = await deleteMedicalCondition(id)
      if (res.ok) {
        toast.success('Condition removed')
        router.refresh()
      } else {
        toast.error('Failed to remove')
      }
    })
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete condition"
        >
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this condition?</AlertDialogTitle>
          <AlertDialogDescription>
            It will be removed from your medical history. You can re-add it
            later if needed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function formatRange(c: MedicalCondition): string {
  if (c.start_date && !c.end_date) return `Since ${c.start_date}`
  if (c.start_date && c.end_date) return `${c.start_date} → ${c.end_date}`
  if (!c.start_date && c.end_date) return `Resolved ${c.end_date}`
  return '—'
}

export function MedicalConditionsCard({
  conditions,
}: {
  conditions: MedicalCondition[]
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Medical History</CardTitle>
            <CardDescription>
              Previous or ongoing conditions. All optional — the AI uses this
              to interpret your biomarkers.
            </CardDescription>
          </div>
          <ConditionDialog
            trigger={
              <Button size="sm">
                <Plus className="size-4" /> Add
              </Button>
            }
          />
        </div>
      </CardHeader>
      <CardContent>
        {conditions.length === 0 ? (
          <p className="bg-muted/30 rounded-lg border p-6 text-center text-sm text-muted-foreground">
            No conditions logged yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Condition</th>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                  <th className="w-1 px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {conditions.map((c) => {
                  const ongoing = !c.end_date
                  return (
                    <tr key={c.id} className="border-t">
                      <td className="px-3 py-2 font-medium">
                        {c.condition_name}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatRange(c)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={ongoing ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {ongoing ? 'ongoing' : 'resolved'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[24rem] truncate">
                        {c.notes ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <ConditionDialog
                            initial={c}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Edit condition"
                              >
                                <Pencil className="size-4" />
                              </Button>
                            }
                          />
                          <DeleteConditionButton id={c.id} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
