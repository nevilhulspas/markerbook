'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2 } from 'lucide-react'

import {
  createNextToTestList,
  deleteNextToTestList,
  renameNextToTestList,
} from '@/actions/next-to-test/lists'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { NextToTestList } from '@/lib/database.types'

interface Props {
  lists: NextToTestList[]
  activeListId: string
}

export function ListTabManager({ lists, activeListId }: Props) {
  const router = useRouter()
  const active = lists.find((l) => l.id === activeListId)
  const [createOpen, setCreateOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)

  return (
    <div className="ml-auto flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="List options"
            title="List options"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" /> New list
          </DropdownMenuItem>
          {active && (
            <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
              <Pencil className="mr-2 size-4" /> Rename list
            </DropdownMenuItem>
          )}
          {active && <DeleteListItem list={active} onDeleted={() => router.push('/next-to-test')} />}
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateListDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(newId) => router.push(`/next-to-test?list=${newId}`)}
      />
      {active && (
        <RenameListDialog
          list={active}
          open={renameOpen}
          onOpenChange={setRenameOpen}
          onRenamed={() => router.refresh()}
        />
      )}
    </div>
  )
}

function CreateListDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleClose(next: boolean) {
    if (!next) {
      setName('')
      setError(null)
    }
    onOpenChange(next)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const r = await createNextToTestList(name)
      if ('error' in r) {
        setError(r.error)
        return
      }
      setName('')
      onCreated(r.list.id)
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New list</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ntt-new-list">List name</Label>
            <Input
              id="ntt-new-list"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Annual panel"
              autoFocus
              required
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending && <Loader2 className="mr-1 size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RenameListDialog({
  list,
  open,
  onOpenChange,
  onRenamed,
}: {
  list: NextToTestList
  open: boolean
  onOpenChange: (open: boolean) => void
  onRenamed: () => void
}) {
  const [name, setName] = useState(list.name)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Re-sync the input when the dialog re-opens with a fresh list value.
  function handleOpenChange(next: boolean) {
    if (next) {
      setName(list.name)
      setError(null)
    }
    onOpenChange(next)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const r = await renameNextToTestList(list.id, name)
      if (r.error) {
        setError(r.error)
        return
      }
      onOpenChange(false)
      onRenamed()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename list</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={`ntt-rename-${list.id}`}>List name</Label>
            <Input
              id={`ntt-rename-${list.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending && <Loader2 className="mr-1 size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteListItem({
  list,
  onDeleted,
}: {
  list: NextToTestList
  onDeleted: () => void
}) {
  const [, startTransition] = useTransition()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Trash2 className="mr-2 size-4" /> Delete list
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{list.name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the list and all its entries. You can recreate the list later, but the entries can&apos;t be recovered.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              startTransition(async () => {
                const { error } = await deleteNextToTestList(list.id)
                if (error) {
                  toast.error(error)
                  return
                }
                onDeleted()
              })
            }
          >
            Delete list
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
