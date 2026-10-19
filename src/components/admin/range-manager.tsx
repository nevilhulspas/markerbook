'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import { createRange, updateRange, deleteRange } from '@/actions/admin/ranges'
import { CsvImportDialog } from '@/components/admin/csv-import-dialog'
import { CsvExportButton } from '@/components/admin/csv-export-button'
import { VerifiedBadge } from '@/components/admin/verified-badge'
import type { ReferenceRange } from '@/lib/database.types'
import type { CreateRangeValues } from '@/lib/validations/biomarker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

interface RangeManagerProps {
  biomarkerId: string
  ranges: ReferenceRange[]
}

type RangeFormData = {
  unit: string
  sex: 'male' | 'female' | 'general'
  age_min: string
  age_max: string
  range_low: string
  range_high: string
  source: string
  range_type: 'normal' | 'optimal'
}

const emptyForm: RangeFormData = {
  unit: '',
  sex: 'general',
  age_min: '',
  age_max: '',
  range_low: '',
  range_high: '',
  source: '',
  range_type: 'normal',
}

function rangeToForm(range: ReferenceRange): RangeFormData {
  return {
    unit: range.unit,
    sex: range.sex,
    age_min: range.age_min != null ? String(range.age_min) : '',
    age_max: range.age_max != null ? String(range.age_max) : '',
    range_low: range.range_low != null ? String(range.range_low) : '',
    range_high: range.range_high != null ? String(range.range_high) : '',
    source: range.source,
    range_type: range.range_type,
  }
}

function formToInput(
  biomarkerId: string,
  form: RangeFormData
): CreateRangeValues {
  return {
    biomarker_id: biomarkerId,
    unit: form.unit,
    sex: form.sex,
    age_min: form.age_min ? parseInt(form.age_min, 10) : null,
    age_max: form.age_max ? parseInt(form.age_max, 10) : null,
    range_low: form.range_low ? parseFloat(form.range_low) : null,
    range_high: form.range_high ? parseFloat(form.range_high) : null,
    source: form.source,
    range_type: form.range_type,
  }
}

export function RangeManager({ biomarkerId, ranges }: RangeManagerProps) {
  const router = useRouter()
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<RangeFormData>(emptyForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ReferenceRange | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  function updateField<K extends keyof RangeFormData>(
    key: K,
    value: RangeFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function startAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setIsAdding(true)
  }

  function startEdit(range: ReferenceRange) {
    setIsAdding(false)
    setEditingId(range.id)
    setForm(rangeToForm(range))
  }

  function cancelEdit() {
    setIsAdding(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSave() {
    if (!form.unit.trim() || !form.source.trim()) {
      toast.error('Unit and source are required')
      return
    }

    setIsSubmitting(true)
    const input = formToInput(biomarkerId, form)

    if (isAdding) {
      const result = await createRange(input)
      if (result.success) {
        toast.success('Range added')
        cancelEdit()
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } else if (editingId) {
      const result = await updateRange(editingId, input)
      if (result.success) {
        toast.success('Range updated')
        cancelEdit()
        router.refresh()
      } else {
        toast.error(result.error)
      }
    }

    setIsSubmitting(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    const result = await deleteRange(deleteTarget.id)
    if (result.success) {
      toast.success('Range deleted')
      router.refresh()
    } else {
      toast.error(result.error)
    }
    setIsDeleting(false)
    setDeleteTarget(null)
  }

  function renderFormRow(key: string) {
    return (
      <TableRow key={key}>
        <TableCell>
          <Input
            placeholder="e.g. mg/dL"
            value={form.unit}
            onChange={(e) => updateField('unit', e.target.value)}
            className="h-8 w-24"
          />
        </TableCell>
        <TableCell>
          <Select
            value={form.sex}
            onValueChange={(v) =>
              updateField('sex', v as 'male' | 'female' | 'general')
            }
          >
            <SelectTrigger className="h-8 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              placeholder="Min"
              value={form.age_min}
              onChange={(e) => updateField('age_min', e.target.value)}
              className="h-8 w-16"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="number"
              placeholder="Max"
              value={form.age_max}
              onChange={(e) => updateField('age_max', e.target.value)}
              className="h-8 w-16"
            />
          </div>
        </TableCell>
        <TableCell>
          <Input
            type="number"
            step="any"
            placeholder="Low"
            value={form.range_low}
            onChange={(e) => updateField('range_low', e.target.value)}
            className="h-8 w-20"
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            step="any"
            placeholder="High"
            value={form.range_high}
            onChange={(e) => updateField('range_high', e.target.value)}
            className="h-8 w-20"
          />
        </TableCell>
        <TableCell>
          <Input
            placeholder="e.g. Mayo Clinic"
            value={form.source}
            onChange={(e) => updateField('source', e.target.value)}
            className="h-8 w-28"
          />
        </TableCell>
        <TableCell>
          <Select
            value={form.range_type}
            onValueChange={(v) =>
              updateField('range_type', v as 'normal' | 'optimal')
            }
          >
            <SelectTrigger className="h-8 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="optimal">Optimal</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={cancelEdit}>
              <X className="size-3" />
            </Button>
            <Button
              size="sm"
              disabled={isSubmitting || !form.unit.trim() || !form.source.trim()}
              onClick={handleSave}
            >
              {isSubmitting && (
                <Loader2 className="mr-1 size-3 animate-spin" />
              )}
              Save
            </Button>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Reference Ranges</h3>
        {!isAdding && !editingId && (
          <div className="flex items-center gap-2">
            <CsvImportDialog biomarkerId={biomarkerId} onSuccess={() => router.refresh()} />
            <CsvExportButton biomarkerId={biomarkerId} />
            <Button size="sm" variant="outline" onClick={startAdd}>
              <Plus className="mr-1 size-3" />
              Add Range
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              <TableHead>Sex</TableHead>
              <TableHead>Age Range</TableHead>
              <TableHead>Low</TableHead>
              <TableHead>High</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranges.map((range) =>
              editingId === range.id ? (
                renderFormRow(`edit-${range.id}`)
              ) : (
                <TableRow key={range.id}>
                  <TableCell>{range.unit}</TableCell>
                  <TableCell className="capitalize">{range.sex}</TableCell>
                  <TableCell>
                    {range.age_min != null || range.age_max != null
                      ? `${range.age_min ?? '0'} - ${range.age_max ?? '999'}`
                      : 'All ages'}
                  </TableCell>
                  <TableCell>{range.range_low ?? '-'}</TableCell>
                  <TableCell>{range.range_high ?? '-'}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5">
                      {range.source}
                      {range.verified_at && (
                        <VerifiedBadge
                          verifiedAt={range.verified_at}
                          sourceUrl={range.source_url}
                        />
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        range.range_type === 'optimal' ? 'default' : 'secondary'
                      }
                    >
                      {range.range_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(range)}
                      >
                        <Pencil className="size-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(range)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}
            {isAdding && renderFormRow('new-range')}
            {ranges.length === 0 && !isAdding && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground"
                >
                  No reference ranges configured.
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
            <AlertDialogTitle>Delete Reference Range</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this reference range ({deleteTarget?.unit},{' '}
              {deleteTarget?.sex}, {deleteTarget?.range_type})? This action cannot be
              undone.
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
