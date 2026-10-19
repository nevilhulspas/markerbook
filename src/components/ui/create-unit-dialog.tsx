'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CreateUnitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (unit: string) => void
}

export function CreateUnitDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateUnitDialogProps) {
  const [unit, setUnit] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = unit.trim()
    if (!trimmed) return
    onCreated(trimmed)
    onOpenChange(false)
    setUnit('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Unit</DialogTitle>
          <DialogDescription>
            Add a new unit of measurement (e.g. mmol/L, ng/dL, pg/mL).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="space-y-1">
            <Label htmlFor="new-unit" className="text-xs">
              Unit
            </Label>
            <Input
              id="new-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. mmol/L"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!unit.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
