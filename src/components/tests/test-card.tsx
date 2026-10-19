'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Calendar, FlaskConical, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { deleteBloodTest, type BloodTestWithCount } from '@/actions/blood-tests'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { APP_LOCALE } from '@/lib/locale'

interface TestCardProps {
  test: BloodTestWithCount
}

function formatDate(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString(APP_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function sampleTypeLabel(type: string): string {
  switch (type) {
    case 'serum':
      return 'Serum'
    case 'plasma':
      return 'Plasma'
    default:
      return 'Unknown'
  }
}

export function TestCard({ test }: TestCardProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)
    const result = await deleteBloodTest(test.id)
    if (result.success) {
      toast.success('Blood test deleted')
      router.refresh()
    } else {
      toast.error(result.error)
      setIsDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-lg">
            <Link
              href={`/tests/${test.id}`}
              className="hover:underline"
            >
              {test.name}
            </Link>
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            <Calendar className="size-3.5" />
            {formatDate(test.test_date)}
          </CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/tests/${test.id}/edit`}>
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
                <AlertDialogTitle>Delete blood test?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &ldquo;{test.name}&rdquo; and all
                  its marker results. This action cannot be undone.
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
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            <FlaskConical className="mr-1 size-3" />
            {test.result_count} marker{test.result_count === 1 ? '' : 's'}
          </Badge>
          <Badge variant="outline">{sampleTypeLabel(test.sample_type)}</Badge>
        </div>
        {test.notes && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {test.notes}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
