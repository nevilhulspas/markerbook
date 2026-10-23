'use client'

// List-with-per-row-delete for the chat's saved
// memory files. Replaces the bare "Clear AI memory" button — users can now
// see what the AI remembers and remove individual entries instead of
// nuking everything to fix one stale note.

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  deleteInsightsMemoryFile,
  clearInsightsMemory,
  type MemoryFile,
} from '@/actions/insights-memory'
import { APP_LOCALE } from '@/lib/locale'
import { Button } from '@/components/ui/button'
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

function formatTimestamp(iso: string): string {
  // Date-only — minute precision adds noise for a "the AI updated this on…"
  // affordance. Falls back to the raw ISO if the browser can't parse it.
  // Locale is pinned: `undefined` resolves differently on the server (Node)
  // and in the browser, which caused a hydration mismatch on /profile.
  try {
    return new Date(iso).toLocaleDateString(APP_LOCALE, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

function MemoryRow({ file }: { file: MemoryFile }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteInsightsMemoryFile(file.id)
      if (res.error) {
        toast.error('Failed to remove memory')
      } else {
        toast.success('Memory removed')
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <code className="text-xs text-muted-foreground">{file.path}</code>
          <p className="text-xs text-muted-foreground mt-0.5">
            Updated {formatTimestamp(file.updated_at)}
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove this memory"
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this memory?</AlertDialogTitle>
              <AlertDialogDescription>
                Chat will forget this entry. It may re-learn similar facts
                from future conversations.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {/* `whitespace-pre-wrap` keeps the markdown-style line breaks Claude
          typically writes. Width-capped via the surrounding card. */}
      <p className="whitespace-pre-wrap break-words text-sm">
        {file.content || (
          <span className="text-muted-foreground italic">
            (empty file)
          </span>
        )}
      </p>
    </div>
  )
}

export function MemoryManager({ files }: { files: MemoryFile[] }) {
  const router = useRouter()
  const [isClearing, startClearTransition] = useTransition()

  function handleClearAll() {
    startClearTransition(async () => {
      const res = await clearInsightsMemory()
      if (res.error) {
        toast.error('Failed to clear memory')
      } else {
        toast.success('Memory cleared')
        router.refresh()
      }
    })
  }

  if (files.length === 0) {
    return (
      <p className="bg-muted/30 rounded-lg border p-6 text-center text-sm text-muted-foreground">
        Chat hasn&apos;t saved anything yet. It will record notes here as you
        chat — things like preferences or recurring concerns.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {files.map((f) => (
          <MemoryRow key={f.id} file={f} />
        ))}
      </div>
      <div className="flex items-center justify-between border-t pt-3">
        <p className="text-xs text-muted-foreground">
          {files.length} memor{files.length === 1 ? 'y' : 'ies'} stored
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={isClearing}>
              {isClearing && <Loader2 className="size-4 animate-spin" />}
              Clear all
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all Chat memory?</AlertDialogTitle>
              <AlertDialogDescription>
                Chat will forget every saved note. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isClearing}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearAll}
                disabled={isClearing}
              >
                {isClearing && <Loader2 className="size-4 animate-spin" />}
                Clear all
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
