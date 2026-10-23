'use client'

import { Loader2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface FullTestButtonProps {
  onClick: () => void
  isLoading?: boolean
  isStreaming?: boolean
  /** False when the server has no Anthropic API key: the button is off. */
  aiEnabled?: boolean
}

export function FullTestButton({
  onClick,
  isLoading,
  isStreaming,
  aiEnabled = true,
}: FullTestButtonProps) {
  const busy = isLoading || isStreaming

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={busy || !aiEnabled}
      title={aiEnabled ? undefined : 'AI is not set up on this server'}
    >
      {busy ? (
        <>
          <Loader2 className="animate-spin" />
          Interpreting...
        </>
      ) : (
        <>
          <Sparkles />
          Interpret All Markers
        </>
      )}
    </Button>
  )
}
