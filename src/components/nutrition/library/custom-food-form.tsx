'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { saveCustomFood } from '@/actions/nutrition-library'
import type { CustomFood } from '@/lib/database.types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface FormValues {
  id?: string
  name: string
  brand: string
  notes: string
  kcal_per_100g: string
  protein_per_100g: string
  carbs_per_100g: string
  fat_per_100g: string
  fiber_per_100g: string
  sugar_per_100g: string
  sodium_mg_per_100g: string
  sat_fat_per_100g: string
  default_grams: string
}

const PER_100G_FIELDS: readonly (readonly [keyof FormValues, string])[] = [
  ['kcal_per_100g', 'kcal'],
  ['protein_per_100g', 'Protein g'],
  ['carbs_per_100g', 'Carbs g'],
  ['fat_per_100g', 'Fat g'],
  ['fiber_per_100g', 'Fiber g'],
  ['sugar_per_100g', 'Sugar g'],
  ['sodium_mg_per_100g', 'Sodium mg'],
  ['sat_fat_per_100g', 'Sat fat g'],
]

function numOrNull(v: string): number | null {
  return v.trim() === '' ? null : Number(v)
}

function toStringVal(v: number | null | undefined): string {
  return v == null ? '' : String(v)
}

function makeDefaults(existing?: CustomFood): FormValues {
  return {
    id: existing?.id,
    name: existing?.name ?? '',
    brand: existing?.brand ?? '',
    notes: existing?.notes ?? '',
    kcal_per_100g: toStringVal(existing?.kcal_per_100g),
    protein_per_100g: toStringVal(existing?.protein_per_100g),
    carbs_per_100g: toStringVal(existing?.carbs_per_100g),
    fat_per_100g: toStringVal(existing?.fat_per_100g),
    fiber_per_100g: toStringVal(existing?.fiber_per_100g),
    sugar_per_100g: toStringVal(existing?.sugar_per_100g),
    sodium_mg_per_100g: toStringVal(existing?.sodium_mg_per_100g),
    sat_fat_per_100g: toStringVal(existing?.sat_fat_per_100g),
    default_grams: String(existing?.default_grams ?? 100),
  }
}

interface CustomFoodFormProps {
  existing?: CustomFood
  onClose: () => void
}

export function CustomFoodForm({ existing, onClose }: CustomFoodFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [values, setValues] = useState<FormValues>(makeDefaults(existing))
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({})

  function set(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const nextErrors: Partial<Record<keyof FormValues, string>> = {}
    if (!values.name.trim()) {
      nextErrors.name = 'Name is required'
    }
    for (const [key] of PER_100G_FIELDS) {
      const n = numOrNull(values[key] ?? '')
      if (n != null && n < 0) nextErrors[key] = 'Must be ≥ 0'
    }
    const grams = values.default_grams === '' ? 100 : Number(values.default_grams)
    if (!Number.isFinite(grams) || grams <= 0) {
      nextErrors.default_grams = 'Must be > 0'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    startTransition(async () => {
      const res = await saveCustomFood({
        id: values.id,
        name: values.name.trim(),
        brand: values.brand || null,
        notes: values.notes || null,
        kcal_per_100g: numOrNull(values.kcal_per_100g),
        protein_per_100g: numOrNull(values.protein_per_100g),
        carbs_per_100g: numOrNull(values.carbs_per_100g),
        fat_per_100g: numOrNull(values.fat_per_100g),
        fiber_per_100g: numOrNull(values.fiber_per_100g),
        sugar_per_100g: numOrNull(values.sugar_per_100g),
        sodium_mg_per_100g: numOrNull(values.sodium_mg_per_100g),
        sat_fat_per_100g: numOrNull(values.sat_fat_per_100g),
        default_grams: values.default_grams === '' ? 100 : Number(values.default_grams),
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(existing ? 'Food updated' : 'Food saved')
      router.refresh()
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="cf-name">Name *</Label>
        <Input
          id="cf-name"
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="cf-brand">Brand</Label>
        <Input
          id="cf-brand"
          value={values.brand}
          onChange={(e) => set('brand', e.target.value)}
        />
      </div>
      <p className="text-xs text-muted-foreground font-medium pt-1">Per 100g</p>
      <div className="grid grid-cols-2 gap-3">
        {PER_100G_FIELDS.map(([key, label]) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={`cf-${key}`}>{label}</Label>
            <Input
              id={`cf-${key}`}
              type="number"
              step="any"
              min="0"
              placeholder="—"
              value={values[key]}
              onChange={(e) => set(key, e.target.value)}
            />
            {errors[key] && <p className="text-xs text-destructive">{errors[key]}</p>}
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor="cf-default-grams">Default grams</Label>
        <Input
          id="cf-default-grams"
          type="number"
          step="any"
          min="1"
          value={values.default_grams}
          onChange={(e) => set('default_grams', e.target.value)}
        />
        {errors.default_grams && (
          <p className="text-xs text-destructive">{errors.default_grams}</p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="cf-notes">Notes</Label>
        <Input
          id="cf-notes"
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
