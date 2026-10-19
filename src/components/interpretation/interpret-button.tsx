'use client'

import { Loader2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface InterpretButtonProps {
  onClick: () => void
  isLoading?: boolean
  isStreaming?: boolean
}

export function InterpretButton({
  onClick,
  isLoading,
  isStreaming,
}: InterpretButtonProps) {
  const busy = isLoading || isStreaming

  return (
    <Button
      className="w-full"
      onClick={onClick}
      disabled={busy}
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
