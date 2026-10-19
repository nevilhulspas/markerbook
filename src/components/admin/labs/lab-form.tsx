'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { adminCreateLab, adminUpdateLab } from '@/actions/admin/labs'
import type { Lab, LabStatus } from '@/lib/database.types'
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
  STATUS_OPTIONS,
  labFormInitialValues,
  selectClassName,
  toCreateLabInput,
  toUpdateLabPatch,
  validateLabForm,
  type LabFormValues,
} from '@/components/admin/labs/lab-form-values'

interface AddLabDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddLabDialog({ open, onOpenChange }: AddLabDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a lab</DialogTitle>
          <DialogDescription>
            Create a new lab in the directory.
          </DialogDescription>
        </DialogHeader>
        {/* Keyed on `open` so the form remounts with fresh fields each time. */}
        {open && (
          <LabForm key="add-lab-form" mode="create" onSuccess={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface EditLabDialogProps {
  lab: Lab | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditLabDialog({ lab, open, onOpenChange }: EditLabDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit lab</DialogTitle>
          <DialogDescription>Update this lab&apos;s details.</DialogDescription>
        </DialogHeader>
        {/* Keyed on the lab id so the form re-seeds when a different lab opens. */}
        {lab && (
          <LabForm
            key={lab.id}
            mode="edit"
            lab={lab}
            onSuccess={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// `create` starts empty, shows placeholders and a status field, and resets after
// saving; `edit` seeds from the lab and leaves status to the table row's select.
type LabFormProps =
  | { mode: 'create'; onSuccess: () => void }
  | { mode: 'edit'; lab: Lab; onSuccess: () => void }

function LabForm(props: LabFormProps) {
  const { onSuccess } = props
  const isCreate = props.mode === 'create'
  // Distinct ids so the add and edit dialogs never share label targets.
  const idPrefix = isCreate ? 'lab' : 'edit-lab'

  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<LabFormValues>(() =>
    labFormInitialValues(props.mode === 'edit' ? props.lab : null)
  )

  function setField<K extends keyof LabFormValues>(key: K, value: LabFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const validationError = validateLabForm(values)
    if (validationError) {
      setError(validationError)
      return
    }
    startTransition(async () => {
      const result =
        props.mode === 'create'
          ? await adminCreateLab(toCreateLabInput(values))
          : await adminUpdateLab(props.lab.id, toUpdateLabPatch(values))
      if (result.error) {
        setError(result.error)
        return
      }
      if (props.mode === 'create') setValues(labFormInitialValues(null))
      onSuccess()
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-name`}>Name</Label>
          <Input
            id={`${idPrefix}-name`}
            value={values.name}
            onChange={(e) => setField('name', e.target.value)}
            required
            placeholder={isCreate ? 'e.g. Acme Diagnostics' : undefined}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-country`}>Country</Label>
          <Input
            id={`${idPrefix}-country`}
            value={values.country}
            onChange={(e) => setField('country', e.target.value)}
            placeholder={isCreate ? 'e.g. Netherlands' : undefined}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-city`}>City</Label>
          <Input
            id={`${idPrefix}-city`}
            value={values.city}
            onChange={(e) => setField('city', e.target.value)}
            placeholder={isCreate ? 'e.g. Amsterdam' : undefined}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-website`}>Website</Label>
          <Input
            id={`${idPrefix}-website`}
            type="url"
            value={values.website}
            onChange={(e) => setField('website', e.target.value)}
            placeholder={isCreate ? 'https://...' : undefined}
          />
        </div>
        {isCreate && (
          <div className="space-y-1">
            <Label htmlFor="lab-status">Status</Label>
            <select
              id="lab-status"
              value={values.status}
              onChange={(e) => setField('status', e.target.value as LabStatus)}
              className={selectClassName}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Textarea
          id={`${idPrefix}-description`}
          value={values.description}
          onChange={(e) => setField('description', e.target.value)}
          placeholder={isCreate ? 'Optional description...' : undefined}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending && <Loader2 className="mr-1 size-4 animate-spin" />}
        {isCreate ? 'Add lab' : 'Save changes'}
      </Button>
    </form>
  )
}
