'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, RotateCcw, Trash2, Pencil } from 'lucide-react'
import { toast } from 'sonner'

import { bulkMoveEntries } from '@/actions/next-to-test/bulk'
import { deleteEntry, updateEntry } from '@/actions/next-to-test/entries'
import type { NextToTestList } from '@/lib/database.types'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Props {
  entryId: string
  status: 'pending' | 'done'
  note: string | null
  dueDate: string | null
  // AUT-864: surfaces the "Move to another list" picker in the edit popover.
  // When omitted (or only one list exists) the picker is hidden so it doesn't
  // clutter callers that have no choice to offer.
  currentListId: string
  lists: NextToTestList[]
}

export function EntryRowActions({
  entryId,
  status,
  note,
  dueDate,
  currentListId,
  lists,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  function refreshAfter(fn: () => Promise<object>, failure: string) {
    startTransition(async () => {
      const result = await fn()
      if ('error' in result && result.error) {
        toast.error(`${failure} — ${result.error}`)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-1">
      {status === 'pending' ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mark done"
          title="Mark done"
          onClick={() => refreshAfter(() => updateEntry({ id: entryId, status: 'done' }), "Couldn't mark it done")}
        >
          <Check className="size-4" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mark pending"
          title="Mark pending"
          onClick={() => refreshAfter(() => updateEntry({ id: entryId, status: 'pending' }), "Couldn't mark it pending")}
        >
          <RotateCcw className="size-4" />
        </Button>
      )}

      <EditPopover
        // Re-key on the entry's persisted values so a successful save (which
        // bumps these via revalidatePath + router.refresh) discards the stale
        // local useState in the popover.
        key={`edit-${entryId}-${note ?? ''}-${dueDate ?? ''}-${currentListId}`}
        entryId={entryId}
        note={note}
        dueDate={dueDate}
        currentListId={currentListId}
        lists={lists}
        onSaved={() => router.refresh()}
      />

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Delete entry">
            <Trash2 className="size-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from the list. You can always add it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => refreshAfter(() => deleteEntry(entryId), "Couldn't delete the entry")}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function EditPopover({
  entryId,
  note,
  dueDate,
  currentListId,
  lists,
  onSaved,
}: {
  entryId: string
  note: string | null
  dueDate: string | null
  currentListId: string
  lists: NextToTestList[]
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [noteValue, setNoteValue] = useState(note ?? '')
  const [dueValue, setDueValue] = useState(dueDate ?? '')
  // AUT-864: list selector — only renders when there's more than one list
  // to choose between.
  const [listValue, setListValue] = useState(currentListId)
  const [pending, startTransition] = useTransition()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Edit entry" title="Edit">
          <Pencil className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3">
        {lists.length > 1 && (
          <div className="space-y-1">
            <Label htmlFor={`list-${entryId}`}>List</Label>
            <Select value={listValue} onValueChange={setListValue}>
              <SelectTrigger id={`list-${entryId}`}>
                <SelectValue />
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
        )}
        <div className="space-y-1">
          <Label htmlFor={`note-${entryId}`}>Note</Label>
          <Input
            id={`note-${entryId}`}
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`due-${entryId}`}>Due date</Label>
          <Input
            id={`due-${entryId}`}
            type="date"
            value={dueValue}
            onChange={(e) => setDueValue(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              startTransition(async () => {
                const r = await updateEntry({
                  id: entryId,
                  note: noteValue.trim() || null,
                  dueDate: dueValue || null,
                })
                if ('error' in r) {
                  toast.error(`Couldn't save — ${r.error}`)
                  return
                }
                // List moves go through bulkMoveEntries so an entry that
                // already exists on the target list MERGES into it instead of
                // failing with a swallowed 'duplicate' (the old behavior:
                // looked saved, nothing moved). sourceWins: the source row
                // holds the note/due the user JUST typed above — those must
                // overwrite the twin's stale values, not lose to them.
                if (listValue !== currentListId) {
                  const mv = await bulkMoveEntries([entryId], listValue, { sourceWins: true })
                  if ('error' in mv) {
                    toast.error(`Couldn't move — ${mv.error}`)
                    return
                  }
                  if (mv.merged > 0) toast.success('Merged with the entry already on that list')
                }
                setOpen(false)
                onSaved()
              })
            }
            disabled={pending}
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
