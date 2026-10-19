'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { updateMicrobiomeTest } from '@/actions/microbiome-tests'
import {
  microbiomeTestSchema,
  type MicrobiomeTestFormValues,
} from '@/lib/validations/microbiome-test'
import type { MicrobiomeTest } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface MicrobiomeEditFormProps {
  test: MicrobiomeTest
}

export function MicrobiomeEditForm({ test }: MicrobiomeEditFormProps) {
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MicrobiomeTestFormValues>({
    resolver: zodResolver(microbiomeTestSchema),
    defaultValues: {
      name: test.name,
      test_date: test.test_date,
      lab_name: test.lab_name ?? undefined,
      sample_type: test.sample_type ?? undefined,
      notes: test.notes ?? undefined,
    },
  })

  async function onSubmit(values: MicrobiomeTestFormValues) {
    const result = await updateMicrobiomeTest(test.id, values)
    if (result.success) {
      toast.success('Test updated')
      router.push(`/microbiome/${test.id}`)
      router.refresh()
    } else {
      toast.error(result.error ?? 'Update failed')
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-2xl space-y-4"
    >
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
          <Label htmlFor="lab_name">Lab</Label>
          <Input
            id="lab_name"
            {...register('lab_name')}
            placeholder="e.g. Biovis"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sample_type">Sample Type</Label>
          <Input
            id="sample_type"
            {...register('sample_type')}
            placeholder="stool, saliva, …"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} {...register('notes')} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Save Changes
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/microbiome/${test.id}`)}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
