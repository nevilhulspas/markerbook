'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Calendar, Microscope, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { deleteMicrobiomeTest } from '@/actions/microbiome-tests'
import type { MicrobiomeTestWithCount } from '@/actions/microbiome-tests'
import { Button } from '@/components/ui/button'
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { APP_LOCALE } from '@/lib/locale'

interface MicrobiomeTestCardProps {
  test: MicrobiomeTestWithCount
}

function formatDate(dateString: string): string {
  return new Date(dateString + 'T00:00:00').toLocaleDateString(APP_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function MicrobiomeTestCard({ test }: MicrobiomeTestCardProps) {
  const [isDeleting, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteMicrobiomeTest(test.id)
      if (result.success) toast.success('Microbiome test deleted')
      else toast.error(result.error ?? 'Failed to delete')
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-lg">
            <Link href={`/microbiome/${test.id}`} className="hover:underline">
              {test.name}
            </Link>
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            <Calendar className="size-3.5" />
            {formatDate(test.test_date)}
            {test.lab_name && (
              <span className="text-muted-foreground">· {test.lab_name}</span>
            )}
          </CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/microbiome/${test.id}/edit`}>
              <Pencil className="size-4" />
              <span className="sr-only">Edit</span>
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                disabled={isDeleting}
              >
                <Trash2 className="size-4" />
                <span className="sr-only">Delete</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this test?</AlertDialogTitle>
                <AlertDialogDescription>
                  All taxa results and derived scores for{' '}
                  <strong>{test.name}</strong> will be removed. This can&apos;t
                  be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Microscope className="size-3.5" />
          {test.result_count} taxa
        </span>
      </CardContent>
    </Card>
  )
}
