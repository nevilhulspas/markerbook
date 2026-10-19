'use client'
import { useState, useTransition } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toggleLabFavorite } from '@/actions/lab-favorites'

export function LabFavoriteButton({ labId, initialFavorited }: { labId: string; initialFavorited: boolean }) {
  const [favorited, setFavorited] = useState(initialFavorited)
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      aria-label={favorited ? 'Unfavorite lab' : 'Favorite lab'}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const prev = favorited
          setFavorited(!prev)
          const res = await toggleLabFavorite(labId)
          if ('error' in res) setFavorited(prev)
        })
      }
      className="rounded p-1 text-muted-foreground hover:text-foreground"
    >
      <Star className={cn('size-4', favorited && 'fill-yellow-400 text-yellow-400')} />
    </button>
  )
}
