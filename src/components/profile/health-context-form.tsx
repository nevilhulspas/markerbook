'use client'

// AUT-854: optional medical-context fields — smoking, alcohol, pregnancy,
// diet, birth circumstances, allergies, family history, extra notes.
// All optional; an empty submit is fine (it'll just clear/keep nulls).
// Submits via the same updateProfile server action as the personal-info
// form above it on the page.

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { updateProfile } from '@/actions/profile'
import {
  profileSchema,
  type ProfileFormValues,
} from '@/lib/validations/profile'
import type { ClientProfile } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group'

interface HealthContextFormProps {
  initialData: ClientProfile | null
}

// Tri-state radio: explicit yes / no / unknown (unknown = null in DB).
// We use radio rather than checkbox so the user can express "I don't know"
// without it looking like "no".
function YesNoUnknown({
  name,
  label,
  value,
  onChange,
}: {
  name: string
  label: string
  value: boolean | null | undefined
  onChange: (v: boolean | null) => void
}) {
  const current = value === true ? 'yes' : value === false ? 'no' : 'unknown'
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <RadioGroup
        value={current}
        onValueChange={(v) =>
          onChange(v === 'yes' ? true : v === 'no' ? false : null)
        }
        className="flex gap-4"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem id={`${name}-yes`} value="yes" />
          <Label htmlFor={`${name}-yes`} className="font-normal">Yes</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem id={`${name}-no`} value="no" />
          <Label htmlFor={`${name}-no`} className="font-normal">No</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem id={`${name}-unknown`} value="unknown" />
          <Label htmlFor={`${name}-unknown`} className="font-normal">
            Unknown
          </Label>
        </div>
      </RadioGroup>
    </div>
  )
}

export function HealthContextForm({ initialData }: HealthContextFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      smoking_status: initialData?.smoking_status ?? undefined,
      alcohol_drinks_per_week:
        initialData?.alcohol_drinks_per_week ?? undefined,
      pregnancy_status: initialData?.pregnancy_status ?? undefined,
      diet_pattern: initialData?.diet_pattern ?? undefined,
      born_via_csection: initialData?.born_via_csection ?? null,
      breastfed_as_infant: initialData?.breastfed_as_infant ?? null,
      known_allergies: initialData?.known_allergies ?? undefined,
      family_history: initialData?.family_history ?? undefined,
      extra_notes: initialData?.extra_notes ?? undefined,
    },
  })

  const csection = watch('born_via_csection')
  const breastfed = watch('breastfed_as_infant')

  async function onSubmit(values: ProfileFormValues) {
    setServerError(null)
    // Strip NaN values from empty number inputs (drinks/week).
    const cleaned = {
      ...values,
      alcohol_drinks_per_week:
        values.alcohol_drinks_per_week != null &&
        !Number.isNaN(values.alcohol_drinks_per_week)
          ? values.alcohol_drinks_per_week
          : undefined,
    }
    const result = await updateProfile(cleaned)
    if (result.success) {
      toast.success('Health context saved')
    } else {
      setServerError(result.error)
      toast.error('Failed to save')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Health Context</CardTitle>
        <CardDescription>
          Optional clinical context the AI uses when interpreting your results.
          Skip anything you&apos;d rather not share.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {serverError && (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smoking_status">Smoking</Label>
              <Select
                defaultValue={initialData?.smoking_status ?? undefined}
                onValueChange={(v) =>
                  setValue(
                    'smoking_status',
                    v as ProfileFormValues['smoking_status']
                  )
                }
              >
                <SelectTrigger id="smoking_status" className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never</SelectItem>
                  <SelectItem value="former">Former</SelectItem>
                  <SelectItem value="current">Current</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="alcohol_drinks_per_week">
                Alcohol drinks per week
              </Label>
              <Input
                id="alcohol_drinks_per_week"
                type="number"
                step="0.5"
                min="0"
                placeholder="e.g. 3"
                {...register('alcohol_drinks_per_week', {
                  valueAsNumber: true,
                })}
              />
              {errors.alcohol_drinks_per_week && (
                <p className="text-sm text-destructive">
                  {errors.alcohol_drinks_per_week.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="diet_pattern">Diet pattern</Label>
              <Select
                defaultValue={initialData?.diet_pattern ?? undefined}
                onValueChange={(v) =>
                  setValue(
                    'diet_pattern',
                    v as ProfileFormValues['diet_pattern']
                  )
                }
              >
                <SelectTrigger id="diet_pattern" className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="omnivore">Omnivore</SelectItem>
                  <SelectItem value="pescatarian">Pescatarian</SelectItem>
                  <SelectItem value="vegetarian">Vegetarian</SelectItem>
                  <SelectItem value="vegan">Vegan</SelectItem>
                  <SelectItem value="keto">Keto</SelectItem>
                  <SelectItem value="carnivore">Carnivore</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pregnancy_status">Pregnancy status</Label>
              <Select
                defaultValue={initialData?.pregnancy_status ?? undefined}
                onValueChange={(v) =>
                  setValue(
                    'pregnancy_status',
                    v as ProfileFormValues['pregnancy_status']
                  )
                }
              >
                <SelectTrigger id="pregnancy_status" className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_pregnant">Not pregnant</SelectItem>
                  <SelectItem value="pregnant">Pregnant</SelectItem>
                  <SelectItem value="breastfeeding">Breastfeeding</SelectItem>
                  <SelectItem value="not_applicable">
                    Not applicable
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <YesNoUnknown
              name="born_via_csection"
              label="Born via C-section?"
              value={csection}
              onChange={(v) => setValue('born_via_csection', v)}
            />
            <YesNoUnknown
              name="breastfed_as_infant"
              label="Breastfed as infant?"
              value={breastfed}
              onChange={(v) => setValue('breastfed_as_infant', v)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="known_allergies">Known allergies</Label>
            <Textarea
              id="known_allergies"
              rows={2}
              placeholder="Drug, food, or environmental allergies"
              {...register('known_allergies')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="family_history">Family medical history</Label>
            <Textarea
              id="family_history"
              rows={2}
              placeholder="e.g. Father had heart disease; mother has hypothyroidism"
              {...register('family_history')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="extra_notes">
              Anything else the AI should know
            </Label>
            <Textarea
              id="extra_notes"
              rows={3}
              placeholder="Free text — recent illness, stress, sleep issues, lifestyle changes, anything relevant"
              {...register('extra_notes')}
            />
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Save Health Context
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
