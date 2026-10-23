'use client'

// Floating action bar that appears when the user has ≥1 row
// selected in the next-to-test table. Lives at the top of the table so it
// stays visible while the user scrolls long lists.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  RotateCcw,
  Trash2,
  Loader2,
  ChevronsUpDown,
  X,
  FolderInput,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  bulkMoveEntries,
  bulkUpdateEntryStatus,
  bulkDeleteEntries,
} from '@/actions/next-to-test/bulk'
import type { NextToTestList } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

interface Props {
  selectedIds: string[]
  lists: NextToTestList[]
  currentListId: string
  onClear: () => void
}

export function BulkActionsBar({
  selectedIds,
  lists,
  currentListId,
  onClear,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [moveOpen, setMoveOpen] = useState(false)
  const count = selectedIds.length

  // Returns true on success → clear selection + refresh; false on failure
  // → keep the selection so the user can retry without re-clicking N rows.
  // The previous version used a `finally` block, which cleared even on
  // network/server errors (handlers swallow their own errors with a toast
  // and return, so the try/catch never saw a throw).
  function run(fn: () => Promise<boolean>) {
    startTransition(async () => {
      const ok = await fn()
      if (ok) {
        onClear()
        router.refresh()
      }
    })
  }

  function handleMove(listId: string) {
    const target = lists.find((l) => l.id === listId)
    setMoveOpen(false)
    run(async () => {
      const r = await bulkMoveEntries(selectedIds, listId)
      if ('error' in r) {
        toast.error(r.error)
        return false
      }
      if (r.merged > 0) {
        toast.success(
          `Moved ${r.moved} to ${target?.name ?? 'list'} · ${r.merged} merged with entries already there`
        )
      } else {
        toast.success(`Moved ${r.moved} to ${target?.name ?? 'list'}`)
      }
      return true
    })
  }

  function handleStatus(status: 'pending' | 'done') {
    run(async () => {
      const r = await bulkUpdateEntryStatus(selectedIds, status)
      if ('error' in r) {
        toast.error(r.error)
        return false
      }
      toast.success(
        status === 'done'
          ? `Marked ${r.count} done`
          : `Marked ${r.count} pending`
      )
      return true
    })
  }

  function handleDelete() {
    run(async () => {
      const r = await bulkDeleteEntries(selectedIds)
      if ('error' in r) {
        toast.error(r.error)
        return false
      }
      toast.success(`Removed ${r.count}`)
      return true
    })
  }

  // Filter out the current list from the Move dropdown — moving to the list
  // you're already on is a no-op the user shouldn't be asked to confirm.
  const moveTargets = lists.filter((l) => l.id !== currentListId)

  return (
    <div
      // sticky inside the table-controls flow so it floats above the table
      // when the user scrolls but stays scoped to the next-to-test page.
      className="bg-background sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 shadow-sm"
      role="toolbar"
      aria-label="Bulk actions"
    >
      <span className="text-sm font-medium">
        {count} selected
      </span>
      <button
        type="button"
        onClick={onClear}
        className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
        disabled={pending}
      >
        Clear
      </button>
      <span className="bg-border mx-1 h-4 w-px" aria-hidden />

      {moveTargets.length > 0 && (
        <DropdownMenu open={moveOpen} onOpenChange={setMoveOpen}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={pending}>
              <FolderInput className="size-4" />
              Move to…
              <ChevronsUpDown className="size-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {moveTargets.map((l) => (
              <DropdownMenuItem
                key={l.id}
                onClick={() => handleMove(l.id)}
                className="text-sm"
              >
                {l.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Button
        size="sm"
        variant="outline"
        onClick={() => handleStatus('done')}
        disabled={pending}
      >
        <Check className="size-4" />
        Mark done
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleStatus('pending')}
        disabled={pending}
      >
        <RotateCcw className="size-4" />
        Mark pending
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={pending}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {count} entries?</AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll be removed from your next-to-test lists. You can
              always add them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Delete {count}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pending && (
        <span className="text-muted-foreground ml-auto flex items-center gap-1.5 text-xs">
          <Loader2 className="size-3 animate-spin" />
          Working…
        </span>
      )}

      <button
        type="button"
        onClick={onClear}
        className="text-muted-foreground hover:text-foreground ml-auto rounded p-1"
        aria-label="Clear selection"
        disabled={pending}
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
