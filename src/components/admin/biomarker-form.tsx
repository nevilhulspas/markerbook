'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { z } from 'zod'

import {
  createBiomarker,
  updateBiomarker,
  type AdminBiomarker,
} from '@/actions/admin/biomarkers'
import {
  createBiomarkerSchema,
  type CreateBiomarkerValues,
} from '@/lib/validations/biomarker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type BiomarkerFormInput = z.input<typeof createBiomarkerSchema>

const CATEGORIES = [
  'Hematology',
  'Metabolic',
  'Lipid Panel',
  'Liver',
  'Kidney',
  'Thyroid',
  'Vitamins & Minerals',
  'Hormones',
  'Inflammation',
  'Cardiac',
  'Diabetes',
  'Electrolytes',
  'Iron Studies',
  'Immune',
  'Other',
]

const UNITS = [
  '%',
  'fL',
  'g/dL',
  'g/L',
  'index',
  'IU/L',
  'IU/mL',
  'kU/L',
  'mEq/L',
  'mg/dL',
  'mg/L',
  'mIU/L',
  'mIU/mL',
  'mL/min/1.73m2',
  'mm/hr',
  'mmHg',
  'mmol/L',
  'µmol/L',
  'ng/dL',
  'ng/mg',
  'ng/mL',
  'nmol/L',
  'pg',
  'pg/mL',
  'pmol/L',
  'ratio',
  'titer',
  'U/L',
  'U/mL',
  'ug/dL',
  'ug/g',
  'ug/gCrea',
  'ug/L',
  'ug/mg',
  'uIU/mL',
  'x10^3/uL',
  'x10^6/uL',
  'μg/L',
]

interface BiomarkerFormProps {
  biomarker?: AdminBiomarker
  onSuccess?: () => void
}

export function BiomarkerForm({ biomarker, onSuccess }: BiomarkerFormProps) {
  const router = useRouter()
  const isEdit = !!biomarker

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BiomarkerFormInput, unknown, CreateBiomarkerValues>({
    resolver: zodResolver(createBiomarkerSchema),
    defaultValues: biomarker
      ? {
          name: biomarker.name,
          short_name: biomarker.short_name ?? undefined,
          category: biomarker.category,
          unit: biomarker.unit,
          description: biomarker.description ?? undefined,
          panel_id: biomarker.panel_id ?? undefined,
          parent_id: biomarker.parent_id ?? undefined,
          variant_name: biomarker.variant_name ?? undefined,
          aliases: biomarker.aliases ?? [],
        }
      : {
          name: '',
          category: '',
          unit: '',
          aliases: [],
        },
  })

  const categoryValue = watch('category')
  const unitValue = watch('unit')

  async function onSubmit(data: CreateBiomarkerValues) {
    if (isEdit) {
      const result = await updateBiomarker(biomarker.id, data)
      if (result.success) {
        toast.success('Biomarker updated')
        router.refresh()
        onSuccess?.()
      } else {
        toast.error(result.error)
      }
    } else {
      const result = await createBiomarker(data)
      if (result.success) {
        toast.success('Biomarker created')
        router.push(`/admin/biomarkers/${result.biomarkerId}`)
        onSuccess?.()
      } else {
        toast.error(result.error)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" {...register('name')} placeholder="e.g. Hemoglobin" />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="short_name">Short Name</Label>
          <Input
            id="short_name"
            {...register('short_name')}
            placeholder="e.g. Hb"
          />
          {errors.short_name && (
            <p className="text-xs text-destructive">{errors.short_name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category">Category *</Label>
          <Select
            value={categoryValue}
            onValueChange={(val) => setValue('category', val, { shouldValidate: true })}
          >
            <SelectTrigger id="category" className="w-full">
              <SelectValue placeholder="Select category..." />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-xs text-destructive">{errors.category.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="unit">Default Unit *</Label>
          <Select
            value={unitValue}
            onValueChange={(val) => setValue('unit', val, { shouldValidate: true })}
          >
            <SelectTrigger id="unit" className="w-full">
              <SelectValue placeholder="Select unit..." />
            </SelectTrigger>
            <SelectContent>
              {(unitValue && !UNITS.includes(unitValue) ? [unitValue, ...UNITS] : UNITS).map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.unit && (
            <p className="text-xs text-destructive">{errors.unit.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="variant_name">Variant Name</Label>
          <Input
            id="variant_name"
            {...register('variant_name')}
            placeholder="e.g. Direct"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="aliases">Aliases (comma-separated)</Label>
          <Input
            id="aliases"
            defaultValue={biomarker?.aliases?.join(', ') ?? ''}
            onChange={(e) => {
              const val = e.target.value
              const arr = val
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
              setValue('aliases', arr)
            }}
            placeholder="e.g. HGB, Hgb"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Brief description of this biomarker..."
          rows={3}
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="panel_id">Panel ID</Label>
          <Input
            id="panel_id"
            {...register('panel_id')}
            placeholder="UUID (optional)"
          />
          {errors.panel_id && (
            <p className="text-xs text-destructive">{errors.panel_id.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="parent_id">Parent ID</Label>
          <Input
            id="parent_id"
            {...register('parent_id')}
            placeholder="UUID (optional, for variants)"
          />
          {errors.parent_id && (
            <p className="text-xs text-destructive">{errors.parent_id.message}</p>
          )}
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-1 size-4 animate-spin" />}
        {isEdit ? 'Save Changes' : 'Create Biomarker'}
      </Button>
    </form>
  )
}
