'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { createUnit, deleteUnit } from '@/actions/admin/units'
import type { BiomarkerUnit } from '@/lib/database.types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface UnitManagerProps {
  biomarkerId: string
  units: BiomarkerUnit[]
}

export function UnitManager({ biomarkerId, units }: UnitManagerProps) {
  const router = useRouter()
  const [isAdding, setIsAdding] = useState(false)
  const [newUnit, setNewUnit] = useState('')
  const [newFactor, setNewFactor] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BiomarkerUnit | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const defaultUnit = units.find((u) => u.is_default)

  async function handleAdd() {
    if (!newUnit.trim() || !newFactor.trim()) return

    const conversion_factor = parseFloat(newFactor)
    if (isNaN(conversion_factor) || conversion_factor <= 0) {
      toast.error('Conversion factor must be a positive number')
      return
    }

    setIsSubmitting(true)
    const result = await createUnit({
      biomarker_id: biomarkerId,
      unit: newUnit.trim(),
      is_default: false,
      conversion_factor,
    })

    if (result.success) {
      toast.success('Unit added')
      setNewUnit('')
      setNewFactor('')
      setIsAdding(false)
      router.refresh()
    } else {
      toast.error(result.error)
    }
    setIsSubmitting(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    const result = await deleteUnit(deleteTarget.id)
    if (result.success) {
      toast.success('Unit deleted')
      router.refresh()
    } else {
      toast.error(result.error)
    }
    setIsDeleting(false)
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Units</h3>
        {!isAdding && (
          <Button size="sm" variant="outline" onClick={() => setIsAdding(true)}>
            <Plus className="mr-1 size-3" />
            Add Unit
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              <TableHead>Conversion Factor</TableHead>
              <TableHead>Default</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.map((unit) => (
              <TableRow key={unit.id}>
                <TableCell className="font-medium">{unit.unit}</TableCell>
                <TableCell>
                  {unit.is_default
                    ? '1 (base unit)'
                    : defaultUnit
                      ? `1 ${defaultUnit.unit} = ${unit.conversion_factor} ${unit.unit}`
                      : unit.conversion_factor}
                </TableCell>
                <TableCell>
                  {unit.is_default && <Badge variant="default">Default</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {!unit.is_default && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(unit)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {isAdding && (
              <TableRow>
                <TableCell>
                  <Input
                    placeholder="e.g. mmol/L"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="any"
                    placeholder="e.g. 0.0555"
                    value={newFactor}
                    onChange={(e) => setNewFactor(e.target.value)}
                    className="h-8"
                  />
                </TableCell>
                <TableCell />
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsAdding(false)
                        setNewUnit('')
                        setNewFactor('')
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={isSubmitting || !newUnit.trim() || !newFactor.trim()}
                      onClick={handleAdd}
                    >
                      {isSubmitting && (
                        <Loader2 className="mr-1 size-3 animate-spin" />
                      )}
                      Save
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {units.length === 0 && !isAdding && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No units configured.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Unit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the unit &quot;{deleteTarget?.unit}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting && <Loader2 className="mr-1 size-3 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
