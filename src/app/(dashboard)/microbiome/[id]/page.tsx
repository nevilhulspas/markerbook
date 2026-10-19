import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'

import { getMicrobiomeTestDetail } from '@/actions/microbiome-tests'
import { Button } from '@/components/ui/button'
import { MicrobiomeScores } from '@/components/microbiome/microbiome-scores'
import { MicrobiomeTable } from '@/components/microbiome/microbiome-table'
import { PageContainer } from '@/components/layout/page-container'
import { APP_LOCALE } from '@/lib/locale'
import { notFoundOrAuthOutage } from '@/lib/supabase/session'

export const metadata: Metadata = {
  title: 'Microbiome Test Detail | Blood Markers Tracker',
}

function formatDate(dateString: string): string {
  return new Date(dateString + 'T00:00:00').toLocaleDateString(APP_LOCALE, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function MicrobiomeTestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { data: test, error } = await getMicrobiomeTestDetail(id)

  if (error || !test) {
    return notFoundOrAuthOutage(error)
  }

  return (
    <PageContainer width="wide" className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/microbiome">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to microbiome tests</span>
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{test.name}</h1>
          <p className="text-muted-foreground">
            {formatDate(test.test_date)}
            {test.lab_name ? ` · ${test.lab_name}` : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/microbiome/${id}/edit`}>
            <Pencil className="size-4" />
            Edit
          </Link>
        </Button>
      </div>

      <MicrobiomeScores scores={test.microbiome_scores} />

      <MicrobiomeTable results={test.microbiome_results} />

      {test.notes && (
        <div className="rounded-lg border bg-card p-4 text-sm">
          <h3 className="mb-2 font-semibold">Notes</h3>
          <p className="whitespace-pre-wrap text-muted-foreground">
            {test.notes}
          </p>
        </div>
      )}
    </PageContainer>
  )
}
