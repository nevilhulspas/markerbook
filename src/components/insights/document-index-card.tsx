'use client'

import { useState } from 'react'
import { FileCheck2, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { persistChatDocument } from '@/actions/chat-attachments'

export interface DocumentIndexSummary {
  title: string
  dateLabel: string | null
  lines: string[]
}

interface DocumentIndexCardProps {
  extractionId: string
  summary: DocumentIndexSummary
  onResolve: (output: { choice: 'logged'; href: string } | { choice: 'chat-only' }) => void
}

/** Lightweight confirm card: log the detected document, or keep it for this chat. */
export function DocumentIndexCard({ extractionId, summary, onResolve }: DocumentIndexCardProps) {
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleLog() {
    setState('saving')
    setError(null)
    const res = await persistChatDocument(extractionId)
    if (res.success) {
      setState('done')
      onResolve({ choice: 'logged', href: res.href })
    } else {
      setState('error')
      setError(res.error)
    }
  }

  const resolved = state === 'done'
  // Defensive: this card can be rendered while the tool input is still
  // streaming, so summary fields may be partial. Never throw on missing data.
  const lines = summary?.lines ?? []

  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <FileCheck2 className="size-4" />
        Detected: {summary?.title ?? 'document'}
        {summary?.dateLabel && <span className="text-muted-foreground">· {summary.dateLabel}</span>}
      </div>
      {lines.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-muted-foreground">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-destructive">{error}</p>}
      {!resolved ? (
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={handleLog} disabled={state === 'saving'}>
            {state === 'saving' && <Loader2 className="size-3.5 animate-spin" />}
            Log it to my record
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={state === 'saving'}
            onClick={() => onResolve({ choice: 'chat-only' })}
          >
            Just this chat
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-muted-foreground">Logged to your record.</p>
      )}
    </div>
  )
}
