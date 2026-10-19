'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'

import type { FoodLog, MatchSource } from '@/lib/database.types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { deleteFoodLog } from '@/actions/nutrition-food-logs'
import { FoodLogEditDialog } from './food-log-edit-dialog'

function MatchBadge({ source }: { source: MatchSource | null }) {
  if (source === 'nevo' || source === 'off' || source === 'legacy_usda') {
    return <Badge variant="secondary">matched</Badge>
  }
  if (source === 'recipe') {
    return <Badge variant="secondary">meal</Badge>
  }
  if (source === 'custom_food') {
    return <Badge variant="secondary">custom</Badge>
  }
  if (source === 'estimate') {
    return <Badge variant="outline">estimated</Badge>
  }
  // manual / null → no badge
  return null
}

export function FoodLogItem({ log }: { log: FoodLog }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  function remove() {
    start(async () => {
      const r = await deleteFoodLog(log.id)
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success('Deleted')
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{log.food_name}</span>
          <MatchBadge source={log.match_source} />
        </div>
        <div className="text-muted-foreground text-sm tabular-nums">
          {log.grams != null ? `${Math.round(log.grams)}g · ` : ''}
          {Math.round(log.calories ?? 0)} kcal · {Math.round(log.protein_g ?? 0)}p /{' '}
          {Math.round(log.carbs_g ?? 0)}c / {Math.round(log.fat_g ?? 0)}f
          {log.notes ? ` · ${log.notes}` : ''}
        </div>
      </div>
      <FoodLogEditDialog log={log} />
      <Button variant="ghost" size="icon" aria-label="Delete meal" disabled={pending} onClick={remove}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}
