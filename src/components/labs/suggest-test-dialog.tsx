'use client'

import { useState, useTransition } from 'react'
import { Loader2, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { suggestLabTest } from '@/actions/lab-test-suggestions'

export function SuggestTestDialog({ labId }: { labId: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [url, setUrl] = useState('')

  function resetForm() {
    setUrl('')
    setError(null)
    setNotice(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const result = await suggestLabTest({ labId, url })
      if (result.error || !result.data) {
        setError(result.error ?? 'Could not add the test.')
        return
      }
      const { added, duplicates } = result.data
      if (added.length === 0) {
        setNotice(
          duplicates.length > 0
            ? 'That test is already listed or waiting for review.'
            : 'Nothing new to add from that page.'
        )
        return
      }
      const summary =
        duplicates.length > 0
          ? `Thanks! Sent ${added.join(', ')} for review (${duplicates.length} already listed). It appears here once an admin approves it.`
          : `Thanks! Sent ${added.join(', ')} for review. It appears here once an admin approves it.`
      setNotice(summary)
      setUrl('')
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          <Plus className="mr-1 size-4" />
          Suggest a missing test for this lab
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suggest a missing test</DialogTitle>
          <DialogDescription>
            Paste the link to the test&apos;s page on this lab&apos;s website. We&apos;ll
            check the page, translate it, and send the test to an admin for review if it
            isn&apos;t already listed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="suggest-test-url">Test page URL</Label>
            <Input
              id="suggest-test-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              placeholder="https://…"
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          {notice && <p className="text-muted-foreground text-sm">{notice}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false)
                resetForm()
              }}
              disabled={pending}
            >
              Close
            </Button>
            <Button type="submit" disabled={pending || !url.trim()}>
              {pending && <Loader2 className="mr-1 size-4 animate-spin" />}
              Add test
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
