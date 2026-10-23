'use client'

import { Loader2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface InterpretButtonProps {
  onClick: () => void
  isLoading?: boolean
  isStreaming?: boolean
  /** False when the server has no Anthropic API key: the button is off. */
  aiEnabled?: boolean
}

export function InterpretButton({
  onClick,
  isLoading,
  isStreaming,
  aiEnabled = true,
}: InterpretButtonProps) {
  const busy = isLoading || isStreaming

  return (
    <Button
      className="w-full"
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
          Interpret
        </>
      )}
    </Button>
  )
}
