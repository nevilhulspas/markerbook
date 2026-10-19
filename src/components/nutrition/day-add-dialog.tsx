'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { QuickAdd } from './quick-add'

interface DayAddDialogProps {
  dayKey: string
}

export function DayAddDialog({ dayKey }: DayAddDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Add meal to this day" className="size-7">
          <Plus className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add meal</DialogTitle>
        </DialogHeader>
        <QuickAdd compact defaultDate={dayKey} />
      </DialogContent>
    </Dialog>
  )
}
