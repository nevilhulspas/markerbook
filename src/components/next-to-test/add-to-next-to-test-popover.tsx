'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { NextToTestList } from '@/lib/database.types'
import { AddNextToTestForm } from './add-next-to-test-form'

interface Props {
  target:
    | { kind: 'biomarker'; biomarkerId: string }
    | { kind: 'lab_test'; labTestId: string }
  lists: NextToTestList[]
  /** Ids of lists this item is already on (for the trigger-button label). */
  onLists: string[]
}

export function AddToNextToTestPopover({ target, lists, onLists }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const onCount = onLists.length
  const labelTitle =
    onCount > 0
      ? `Already on ${onCount} list${onCount === 1 ? '' : 's'} — click to add to another`
      : 'Add to next-to-test'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          aria-label={labelTitle}
          title={labelTitle}
        >
          {onCount > 0 ? (
            <>
              <Check className="text-primary size-3.5" />
              <span className="text-muted-foreground">on {onCount}</span>
            </>
          ) : (
            <>
              <Plus className="size-3.5" />
              <span className="text-muted-foreground">next to test</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <AddNextToTestForm
          target={target}
          lists={lists}
          // Pre-pick the user's most-recently-created list — they're adding
          // from across the site (no tab context), so their newest list is
          // the most likely target. The page-level dialog uses the active tab
          // instead; the form itself falls back to lists[0] as a last resort.
          defaultListId={lists[lists.length - 1]?.id}
          onAdded={() => {
            setOpen(false)
            router.refresh()
          }}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}
