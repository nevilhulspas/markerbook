'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { updateDutchTest } from '@/actions/dutch-tests'
import {
  dutchTestSchema,
  type DutchTestFormValues,
} from '@/lib/validations/dutch-test'
import type { DutchTest } from '@/lib/database.types'
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

const PHASE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'follicular', label: 'Follicular' },
  { value: 'luteal', label: 'Luteal' },
  { value: 'postmenopausal', label: 'Postmenopausal' },
  { value: 'oral_progesterone', label: 'Oral Progesterone' },
  { value: 'oral_contraceptive', label: 'Oral Contraceptive' },
  { value: 'male', label: 'Male' },
]

interface DutchEditFormProps {
  test: DutchTest
}

export function DutchEditForm({ test }: DutchEditFormProps) {
  const router = useRouter()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DutchTestFormValues>({
    resolver: zodResolver(dutchTestSchema),
    defaultValues: {
      name: test.name,
      test_date: test.test_date,
      menstrual_phase: test.menstrual_phase ?? 'unknown',
      cycle_day: test.cycle_day ?? undefined,
      notes: test.notes ?? undefined,
    },
  })

  const phaseValue = watch('menstrual_phase') ?? 'unknown'

  async function onSubmit(values: DutchTestFormValues) {
    const result = await updateDutchTest(test.id, {
      ...values,
      menstrual_phase:
        values.menstrual_phase === 'unknown' ? null : values.menstrual_phase,
    })
    if (result.success) {
      toast.success('Test updated')
      router.push(`/dutch/${test.id}`)
      router.refresh()
    } else {
      toast.error(result.error ?? 'Update failed')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">Test Name *</Label>
          <Input id="name" {...register('name')} />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="test_date">Test Date *</Label>
          <Input id="test_date" type="date" {...register('test_date')} />
          {errors.test_date && (
            <p className="text-xs text-destructive">
              {errors.test_date.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="menstrual_phase">Menstrual Phase</Label>
          <Select
            value={phaseValue}
            onValueChange={(val) =>
              setValue(
                'menstrual_phase',
                val as DutchTestFormValues['menstrual_phase'],
                { shouldValidate: true }
              )
            }
          >
            <SelectTrigger id="menstrual_phase" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PHASE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cycle_day">Cycle Day</Label>
          <Input
            id="cycle_day"
            type="number"
            min={1}
            max={60}
            {...register('cycle_day', {
              setValueAs: (v) =>
                v === '' || v == null ? null : Number(v),
            })}
          />
          {errors.cycle_day && (
            <p className="text-xs text-destructive">
              {errors.cycle_day.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} {...register('notes')} />
        {errors.notes && (
          <p className="text-xs text-destructive">{errors.notes.message}</p>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Save Changes
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/dutch/${test.id}`)}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
