'use client'

import { Loader2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface FullTestButtonProps {
  onClick: () => void
  isLoading?: boolean
  isStreaming?: boolean
}

export function FullTestButton({
  onClick,
  isLoading,
  isStreaming,
}: FullTestButtonProps) {
  const busy = isLoading || isStreaming

  return (
    <Button
      variant="outline"
      size="sm"
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
          Interpret All Markers
        </>
      )}
    </Button>
  )
}
