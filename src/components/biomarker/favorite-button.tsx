'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { toggleFavorite } from '@/actions/favorites'
import { cn } from '@/lib/utils'

interface FavoriteButtonProps {
  biomarkerId: string
  initialFavorited: boolean
}

export function FavoriteButton({
  biomarkerId,
  initialFavorited,
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited)
  const [isPending, setIsPending] = useState(false)

  async function handleToggle() {
    setIsPending(true)
    const result = await toggleFavorite(biomarkerId)
    setIsPending(false)

    if ('favorited' in result) {
      setFavorited(result.favorited)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      disabled={isPending}
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Star
        className={cn(
          'size-5',
          favorited
            ? 'fill-yellow-400 text-yellow-400'
            : 'text-muted-foreground'
        )}
      />
    </Button>
  )
}
