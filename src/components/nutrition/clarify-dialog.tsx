'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ClarifyDialogProps {
  question: string | null
  pending: boolean
  onAnswer: (answer: string) => void
  onSkip: () => void
  /** Called when the dialog is dismissed without an answer (X / Esc / overlay click). */
  onCancel: () => void
}

export function ClarifyDialog({
  question,
  pending,
  onAnswer,
  onSkip,
  onCancel,
}: ClarifyDialogProps) {
  const [answer, setAnswer] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Autofocus the input when the dialog opens.
  // Answer text resets automatically because the dialog is keyed on the question
  // string in the parent (see ClarifyDialog usage in quick-add).
  useEffect(() => {
    if (question) {
      // Small delay so the dialog animation has time to render.
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [question])

  function submit() {
    const trimmed = answer.trim()
    if (!trimmed) return
    onAnswer(trimmed)
  }

  function handleOpenChange(open: boolean) {
    if (!open && !pending) {
      onCancel()
    }
  }

  return (
    <Dialog open={question !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick question</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground italic">{question}</p>
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={answer}
            placeholder="Your answer…"
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            disabled={pending}
            className="flex-1"
          />
          <Button onClick={submit} disabled={pending || !answer.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : 'Answer'}
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="flex w-full items-center gap-2 text-muted-foreground"
          onClick={onSkip}
          disabled={pending}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Just log it
        </Button>
      </DialogContent>
    </Dialog>
  )
}
