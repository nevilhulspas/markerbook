'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Lightbulb } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { submitMarkerSuggestion } from '@/actions/marker-suggestions'
import {
  suggestionSchema,
  BIOMARKER_CATEGORIES,
  type SuggestionValues,
} from '@/lib/validations/suggestion'

export function SuggestionForm() {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    watch,
    reset,
    setValue,
  } = useForm<SuggestionValues>({
    resolver: zodResolver(suggestionSchema),
    defaultValues: {
      type: 'marker',
      name: '',
      category: '',
      details: '',
    },
  })

  const watchType = watch('type')

  async function onSubmit(data: SuggestionValues) {
    setServerError(null)
    setIsSubmitting(true)
    const result = await submitMarkerSuggestion(data)
    setIsSubmitting(false)

    if (result.success) {
      setSubmitted(true)
      reset()
      setTimeout(() => {
        setSubmitted(false)
        setOpen(false)
      }, 2000)
    } else {
      setServerError(result.error)
    }
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen)
    if (!isOpen) {
      reset()
      setServerError(null)
    }
  }

  return (
    <div className="rounded-lg border border-dashed p-6 text-center">
      <Lightbulb className="mx-auto mb-2 size-5 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Can&apos;t find what you&apos;re looking for?
      </p>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="mt-2">
            Suggest a Marker or Unit
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suggest a Marker or Unit</DialogTitle>
            <DialogDescription>
              Let us know what&apos;s missing from the catalog.
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <Check className="size-8 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-700 dark:text-green-300">
                Thanks! Your suggestion has been submitted.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="flex gap-3">
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v)
                        if (v === 'unit') {
                          setValue('category', '')
                        }
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="marker">Marker</SelectItem>
                        <SelectItem value="unit">Unit</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />

                <div className="flex-1 space-y-1">
                  <Input
                    placeholder={
                      watchType === 'marker'
                        ? 'e.g. Ferritin'
                        : 'e.g. pmol/L for Vitamin B12'
                    }
                    {...register('name')}
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive">
                      {errors.name.message}
                    </p>
                  )}
                </div>
              </div>

              {watchType === 'marker' && (
                <div className="space-y-1">
                  <Controller
                    name="category"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select category..." />
                        </SelectTrigger>
                        <SelectContent>
                          {BIOMARKER_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.category && (
                    <p className="text-xs text-destructive">
                      {errors.category.message}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <Textarea
                  placeholder="Additional details (optional)"
                  {...register('details')}
                  rows={3}
                />
                {errors.details && (
                  <p className="text-xs text-destructive">
                    {errors.details.message}
                  </p>
                )}
              </div>

              {serverError && (
                <p className="text-sm text-destructive">{serverError}</p>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
