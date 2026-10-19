'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Trash2, OctagonX } from 'lucide-react'
import { toast } from 'sonner'

import { useIsMobile } from '@/hooks/use-mobile'
import {
  createSupplement,
  updateSupplement,
  deleteSupplement,
} from '@/actions/supplements'
import {
  createSupplementSchema,
  type CreateSupplementValues,
} from '@/lib/validations/supplement'
import type { SupplementWithIntakes } from '@/lib/database.types'
import { deriveFrequency } from '@/lib/supplements/intake'
import {
  IntakeMomentsField,
  type IntakeMomentValue,
} from '@/components/supplements/intake-moments-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { appTodayISO } from '@/lib/dates/today'

const DOSE_UNITS = ['mg', 'g', 'mcg', 'µg', 'IU', 'mL', 'drops', 'capsules', 'tablets']

function parseDose(dose: string | null | undefined): { value: string; unit: string } {
  if (!dose) return { value: '', unit: 'mg' }
  const match = dose.match(/^([\d.]+)\s*(.*)$/)
  if (match) return { value: match[1], unit: match[2] || 'mg' }
  return { value: '', unit: 'mg' }
}

interface SupplementEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplement?: SupplementWithIntakes | null
  onSaved?: () => void
  onDeleted?: () => void
}

function SupplementForm({
  supplement,
  onSaved,
  onDeleted,
  onOpenChange,
}: Omit<SupplementEditorProps, 'open'>) {
  const isEditMode = !!supplement
  const isActive = isEditMode && !supplement.end_date
  const [isPending, setIsPending] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)

  const [hasEndDate, setHasEndDate] = useState(!!supplement?.end_date)

  const parsedDose = parseDose(supplement?.dose)
  const [doseValue, setDoseValue] = useState(parsedDose.value)
  const [doseUnit, setDoseUnit] = useState(parsedDose.unit)
  const [intakes, setIntakes] = useState<IntakeMomentValue[]>(
    supplement?.intakes?.map((i) => ({ time: i.time, amount: i.amount })) ?? []
  )

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateSupplementValues>({
    resolver: zodResolver(createSupplementSchema),
    defaultValues: {
      name: supplement?.name ?? '',
      dose: supplement?.dose ?? '',
      start_date: supplement?.start_date ?? '',
      end_date: supplement?.end_date ?? null,
      notes: supplement?.notes ?? '',
    },
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-seed the form when the edited supplement changes
    setHasEndDate(!!supplement?.end_date)
    const d = parseDose(supplement?.dose)
    setDoseValue(d.value)
    setDoseUnit(d.unit)
    setIntakes(
      supplement?.intakes?.map((i) => ({ time: i.time, amount: i.amount })) ?? []
    )
    reset({
      name: supplement?.name ?? '',
      dose: supplement?.dose ?? '',
      start_date: supplement?.start_date ?? '',
      end_date: supplement?.end_date ?? null,
      notes: supplement?.notes ?? '',
    })
  }, [supplement, reset])

  const toggleEndDate = useCallback(() => {
    if (hasEndDate) {
      setValue('end_date', null)
      setHasEndDate(false)
    } else {
      setHasEndDate(true)
    }
  }, [hasEndDate, setValue])

  async function onSubmit(formValues: CreateSupplementValues) {
    // The moments live outside the form (they are a repeatable block, not a
    // registered field), so they are merged back in here.
    const values = { ...formValues, intakes }
    setIsPending(true)
    try {
      if (isEditMode) {
        const result = await updateSupplement(supplement.id, values)
        if (result.success) {
          toast.success('Supplement updated')
          onSaved?.()
          onOpenChange?.(false)
        } else {
          toast.error(result.error ?? 'Failed to update supplement')
        }
      } else {
        const result = await createSupplement(values)
        if (result.success) {
          toast.success('Supplement added')
          onSaved?.()
          onOpenChange?.(false)
        } else {
          toast.error(result.error ?? 'Failed to add supplement')
        }
      }
    } catch {
      toast.error(
        isEditMode
          ? 'Failed to update supplement'
          : 'Failed to add supplement'
      )
    } finally {
      setIsPending(false)
    }
  }

  async function handleDelete() {
    if (!supplement) return
    setIsDeleting(true)
    try {
      const result = await deleteSupplement(supplement.id)
      if (result.success) {
        toast.success('Supplement deleted')
        onDeleted?.()
        onOpenChange?.(false)
      } else {
        toast.error(result.error ?? 'Failed to delete supplement')
      }
    } catch {
      toast.error('Failed to delete supplement')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleStop() {
    if (!supplement) return
    setIsStopping(true)
    try {
      const today = appTodayISO()
      const result = await updateSupplement(supplement.id, { end_date: today })
      if (result.success) {
        toast.success('Supplement stopped')
        onSaved?.()
        onOpenChange?.(false)
      } else {
        toast.error(result.error ?? 'Failed to stop supplement')
      }
    } catch {
      toast.error('Failed to stop supplement')
    } finally {
      setIsStopping(false)
    }
  }

  const anyPending = isPending || isDeleting || isStopping

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="supplement-name">Name</Label>
        <Input
          id="supplement-name"
          placeholder="e.g. Vitamin D3"
          {...register('name')}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Dose per unit (optional)</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            step="any"
            min="0"
            placeholder="e.g. 500"
            className="w-28"
            value={doseValue}
            onChange={(e) => {
              setDoseValue(e.target.value)
              const combined = e.target.value ? `${e.target.value} ${doseUnit}`.trim() : ''
              setValue('dose', combined || undefined)
            }}
          />
          <Select
            value={doseUnit}
            onValueChange={(val) => {
              setDoseUnit(val)
              const combined = doseValue ? `${doseValue} ${val}`.trim() : ''
              setValue('dose', combined || undefined)
            }}
          >
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              {DOSE_UNITS.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {errors.dose && (
          <p className="text-sm text-destructive">{errors.dose.message}</p>
        )}
      </div>

      <IntakeMomentsField value={intakes} onChange={setIntakes} />

      <div className="space-y-2">
        <Label>Frequency</Label>
        <p className="text-sm text-muted-foreground">
          {deriveFrequency(
            intakes.map((i) => ({ time: i.time, amount: i.amount })),
            supplement?.frequency ?? null
          ) ?? '—'}
          <span className="ml-2 text-xs">(from your intake moments)</span>
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="supplement-start-date">
          {hasEndDate ? 'Start Date' : 'Start Date'}
        </Label>
        <Input id="supplement-start-date" type="date" {...register('start_date')} />
        {errors.start_date && (
          <p className="text-sm text-destructive">{errors.start_date.message}</p>
        )}
      </div>

      {hasEndDate && (
        <div className="space-y-2">
          <Label htmlFor="supplement-end-date">End Date</Label>
          <Input id="supplement-end-date" type="date" {...register('end_date')} />
          {errors.end_date && (
            <p className="text-sm text-destructive">{errors.end_date.message}</p>
          )}
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-muted-foreground"
        onClick={toggleEndDate}
      >
        {hasEndDate ? '- Remove end date' : '+ Add end date'}
      </Button>

      <div className="space-y-2">
        <Label htmlFor="supplement-notes">Notes (optional)</Label>
        <Textarea
          id="supplement-notes"
          rows={3}
          placeholder="Additional notes..."
          {...register('notes')}
        />
        {errors.notes && (
          <p className="text-sm text-destructive">{errors.notes.message}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-2">
          {isEditMode && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={anyPending}
                >
                  {isDeleting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete supplement?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this supplement. This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Delete'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {isActive && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-orange-600 hover:text-orange-600"
                  disabled={anyPending}
                >
                  {isStopping ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <OctagonX className="size-4" />
                  )}
                  {isStopping ? 'Stopping...' : 'Stop Supplement'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Stop supplement?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will set today as the end date for this supplement,
                    marking it as no longer active.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isStopping}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleStop}
                    disabled={isStopping}
                  >
                    {isStopping ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Stopping...
                      </>
                    ) : (
                      'Stop Supplement'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {!isEditMode && <div />}
        </div>

        <Button type="submit" disabled={anyPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isEditMode ? 'Update Supplement' : 'Save Supplement'}
        </Button>
      </div>
    </form>
  )
}

export function SupplementEditor({
  open,
  onOpenChange,
  supplement,
  onSaved,
  onDeleted,
}: SupplementEditorProps) {
  const isMobile = useIsMobile()
  const isEditMode = !!supplement
  const title = isEditMode ? 'Edit Supplement' : 'New Supplement'
  const description = isEditMode
    ? 'Update supplement details.'
    : 'Add a supplement or medicine to your stack.'

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 pb-8">
            <SupplementForm
              supplement={supplement}
              onSaved={onSaved}
              onDeleted={onDeleted}
              onOpenChange={onOpenChange}
            />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <SupplementForm
          supplement={supplement}
          onSaved={onSaved}
          onDeleted={onDeleted}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  )
}
