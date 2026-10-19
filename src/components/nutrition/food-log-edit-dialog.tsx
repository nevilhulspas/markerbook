'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'

import type { FoodLog } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FoodLogEditForm } from './food-log-edit-form'

interface FoodLogEditDialogProps {
  log: FoodLog
}

export function FoodLogEditDialog({ log }: FoodLogEditDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Edit meal"
        onClick={() => setOpen(true)}
      >
        <Pencil className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        {/* Don't auto-focus the first field: it's the Date input, and iOS
            opens the native calendar for a focused date field — so the
            dialog appeared with the calendar already covering the form.
            Focus the dialog container instead so keyboard users start
            inside the dialog (Tab reaches the fields) without triggering
            the picker. */}
        <DialogContent
          className="max-w-md"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            ;(e.target as HTMLElement | null)?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit meal</DialogTitle>
          </DialogHeader>
          <FoodLogEditForm log={log} onSaved={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}
