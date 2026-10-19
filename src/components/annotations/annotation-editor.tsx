'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { useIsMobile } from '@/hooks/use-mobile'
import {
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
} from '@/actions/annotations'
import {
  createAnnotationSchema,
  type CreateAnnotationValues,
} from '@/lib/validations/annotation'
import type { Annotation } from '@/lib/database.types'
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

interface AnnotationEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  annotation?: Annotation | null
  defaultDate?: string
  onSaved?: () => void
  onDeleted?: () => void
}

function AnnotationForm({
  annotation,
  defaultDate,
  onSaved,
  onDeleted,
  onOpenChange,
}: Omit<AnnotationEditorProps, 'open'>) {
  const isEditMode = !!annotation
  const [isPending, setIsPending] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [hasEndDate, setHasEndDate] = useState(!!annotation?.end_date)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateAnnotationValues>({
    resolver: zodResolver(createAnnotationSchema),
    defaultValues: {
      title: annotation?.title ?? '',
      body: annotation?.body ?? '',
      date: annotation?.date ?? defaultDate ?? '',
      end_date: annotation?.end_date ?? null,
    },
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-seed the form when the edited annotation changes
    setHasEndDate(!!annotation?.end_date)
    reset({
      title: annotation?.title ?? '',
      body: annotation?.body ?? '',
      date: annotation?.date ?? defaultDate ?? '',
      end_date: annotation?.end_date ?? null,
    })
  }, [annotation, defaultDate, reset])

  const toggleEndDate = useCallback(() => {
    if (hasEndDate) {
      setValue('end_date', null)
      setHasEndDate(false)
    } else {
      setHasEndDate(true)
    }
  }, [hasEndDate, setValue])

  async function onSubmit(values: CreateAnnotationValues) {
    setIsPending(true)
    try {
      if (isEditMode) {
        const result = await updateAnnotation(annotation.id, values)
        if (result.success) {
          toast.success('Annotation updated')
          onSaved?.()
          onOpenChange?.(false)
        } else {
          toast.error(result.error ?? 'Failed to update annotation')
        }
      } else {
        const result = await createAnnotation(values)
        if (result.success) {
          toast.success('Annotation created')
          onSaved?.()
          onOpenChange?.(false)
        } else {
          toast.error(result.error ?? 'Failed to create annotation')
        }
      }
    } catch {
      toast.error(
        isEditMode
          ? 'Failed to update annotation'
          : 'Failed to create annotation'
      )
    } finally {
      setIsPending(false)
    }
  }

  async function handleDelete() {
    if (!annotation) return
    setIsDeleting(true)
    try {
      const result = await deleteAnnotation(annotation.id)
      if (result.success) {
        toast.success('Annotation deleted')
        onDeleted?.()
        onOpenChange?.(false)
      } else {
        toast.error(result.error ?? 'Failed to delete annotation')
      }
    } catch {
      toast.error('Failed to delete annotation')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="annotation-title">Title</Label>
        <Input
          id="annotation-title"
          placeholder="e.g. Started new medication"
          {...register('title')}
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="annotation-body">Body (optional)</Label>
        <Textarea
          id="annotation-body"
          rows={4}
          placeholder="Additional details..."
          {...register('body')}
        />
        {errors.body && (
          <p className="text-sm text-destructive">{errors.body.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="annotation-date">{hasEndDate ? 'Start Date' : 'Date'}</Label>
        <Input id="annotation-date" type="date" {...register('date')} />
        {errors.date && (
          <p className="text-sm text-destructive">{errors.date.message}</p>
        )}
      </div>

      {hasEndDate && (
        <div className="space-y-2">
          <Label htmlFor="annotation-end-date">End Date</Label>
          <Input id="annotation-end-date" type="date" {...register('end_date')} />
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
        {hasEndDate ? '- Remove end date' : '+ Add end date (timespan)'}
      </Button>

      <div className="flex items-center justify-between gap-2 pt-2">
        {isEditMode ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={isDeleting || isPending}
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
                <AlertDialogTitle>Delete annotation?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this annotation. This action
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
        ) : (
          <div />
        )}

        <Button type="submit" disabled={isPending || isDeleting}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isEditMode ? 'Update Annotation' : 'Save Annotation'}
        </Button>
      </div>
    </form>
  )
}

export function AnnotationEditor({
  open,
  onOpenChange,
  annotation,
  defaultDate,
  onSaved,
  onDeleted,
}: AnnotationEditorProps) {
  const isMobile = useIsMobile()
  const isEditMode = !!annotation
  const title = isEditMode ? 'Edit Annotation' : 'New Annotation'
  const description = isEditMode
    ? 'Update the annotation details below.'
    : 'Add a note to your timeline.'

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 pb-8">
            <AnnotationForm
              annotation={annotation}
              defaultDate={defaultDate}
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
        <AnnotationForm
          annotation={annotation}
          defaultDate={defaultDate}
          onSaved={onSaved}
          onDeleted={onDeleted}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  )
}
