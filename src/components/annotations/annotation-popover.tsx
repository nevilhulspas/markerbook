'use client'

import { Plus } from 'lucide-react'

import type { Annotation } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { APP_LOCALE } from '@/lib/locale'

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return new Intl.DateTimeFormat(APP_LOCALE, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

interface AnnotationPopoverProps {
  annotations: Annotation[]
  date: string
  onEdit: (annotation: Annotation) => void
  onAddNew: (date: string) => void
  children: React.ReactNode
}

export function AnnotationPopover({
  annotations,
  date,
  onEdit,
  onAddNew,
  children,
}: AnnotationPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="center" sideOffset={6}>
        <div className="border-b px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">
            {formatDisplayDate(date)}
          </p>
        </div>

        <div className="max-h-48 overflow-y-auto">
          {annotations.map((annotation) => (
            <button
              key={annotation.id}
              type="button"
              onClick={() => onEdit(annotation)}
              className="flex w-full items-start px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
            >
              <span className="mr-2 mt-1 size-1.5 shrink-0 rounded-full bg-primary/70" />
              <div className="min-w-0">
                <span className="block truncate">{annotation.title}</span>
                {annotation.end_date && (
                  <span className="block text-[11px] text-muted-foreground">
                    {formatDisplayDate(annotation.date)} → {formatDisplayDate(annotation.end_date)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="border-t px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full justify-start gap-1.5 text-xs text-muted-foreground"
            onClick={() => onAddNew(date)}
          >
            <Plus className="size-3.5" />
            Add annotation
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
