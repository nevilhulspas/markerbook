'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import type { Biomarker } from '@/lib/database.types'
import {
  bloodTestSchema,
  type BloodTestFormValues,
} from '@/lib/validations/blood-test'
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
import { MarkerEntryList } from '@/components/tests/marker-entry-list'

interface BloodTestFormProps {
  biomarkers: Biomarker[]
  defaultValues?: BloodTestFormValues
  onSubmit: (
    values: BloodTestFormValues
  ) => Promise<{ success: boolean; error?: string | null }>
  submitLabel?: string
}

function formatToday(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function BloodTestForm({
  biomarkers,
  defaultValues,
  onSubmit,
  submitLabel = 'Save Blood Test',
}: BloodTestFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  // Keep the biomarker catalogue in state so a marker created inline (via the
  // "Add a marker" affordance in a row) becomes immediately selectable across
  // every row without a page reload.
  const [biomarkerList, setBiomarkerList] = useState<Biomarker[]>(biomarkers)
  const handleBiomarkerCreated = useCallback((b: Biomarker) => {
    setBiomarkerList((prev) =>
      prev.some((x) => x.id === b.id) ? prev : [...prev, b]
    )
  }, [])

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BloodTestFormValues>({
    resolver: zodResolver(bloodTestSchema),
    defaultValues: defaultValues ?? {
      name: '',
      test_date: formatToday(),
      sample_type: 'unknown',
      notes: undefined,
      markers: [],
    },
  })

  async function onFormSubmit(values: BloodTestFormValues) {
    setServerError(null)

    const result = await onSubmit(values)
    if (result.success) {
      toast.success(
        defaultValues ? 'Blood test updated' : 'Blood test created'
      )
      router.push('/tests')
    } else {
      setServerError(result.error ?? 'An unexpected error occurred')
      toast.error('Failed to save blood test')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {defaultValues ? 'Edit Blood Test' : 'New Blood Test'}
        </CardTitle>
        <CardDescription>
          {defaultValues
            ? 'Update the test details and marker values.'
            : 'Enter the test details and add marker values from your lab results.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
          {serverError && (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Test Name</Label>
              <Input
                id="name"
                placeholder="e.g. Annual Checkup 2026"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="test_date">Test Date</Label>
              <Input
                id="test_date"
                type="date"
                {...register('test_date')}
              />
              {errors.test_date && (
                <p className="text-sm text-destructive">
                  {errors.test_date.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sample_type">Sample Type</Label>
              <Select
                defaultValue={defaultValues?.sample_type ?? 'unknown'}
                onValueChange={(val) =>
                  setValue(
                    'sample_type',
                    val as 'serum' | 'plasma' | 'unknown'
                  )
                }
              >
                <SelectTrigger id="sample_type" className="w-full">
                  <SelectValue placeholder="Select sample type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Unknown</SelectItem>
                  <SelectItem value="serum">Serum</SelectItem>
                  <SelectItem value="plasma">Plasma</SelectItem>
                </SelectContent>
              </Select>
              {errors.sample_type && (
                <p className="text-sm text-destructive">
                  {errors.sample_type.message}
                </p>
              )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes about this test..."
                rows={3}
                {...register('notes')}
              />
              {errors.notes && (
                <p className="text-sm text-destructive">
                  {errors.notes.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Markers</Label>
            {errors.markers && !Array.isArray(errors.markers) && (
              <p className="text-sm text-destructive">
                {errors.markers.message}
              </p>
            )}
            <Controller
              control={control}
              name="markers"
              render={({ field }) => (
                <MarkerEntryList
                  biomarkers={biomarkerList}
                  value={field.value}
                  onChange={field.onChange}
                  onBiomarkerCreated={handleBiomarkerCreated}
                />
              )}
            />
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
