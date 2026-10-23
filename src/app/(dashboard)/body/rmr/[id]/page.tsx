import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'

import { getRmrTest, getProfileActivityLevel } from '@/actions/rmr'
import { APP_LOCALE } from '@/lib/locale'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RmrCard } from '@/components/body/rmr-card'
import { TdeeCard } from '@/components/body/tdee-card'
import { RmrDeleteButton } from '@/components/body/rmr-delete-button'
import { notFoundOrAuthOutage } from '@/lib/supabase/session'

export const metadata: Metadata = {
  title: 'RMR test | Markerbook',
}

export default async function RmrTestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [test, activityLevel] = await Promise.all([
    getRmrTest(id),
    getProfileActivityLevel(),
  ])
  if (!test) return notFoundOrAuthOutage()

  return (
    <PageContainer width="wide" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link href="/body">
              <ArrowLeft className="size-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold tracking-tight">
              {new Date(test.test_date).toLocaleDateString(APP_LOCALE, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </h1>
            <p className="text-muted-foreground">{test.provider ?? 'RMR test'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/body/rmr/${test.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          <RmrDeleteButton testId={test.id} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resting metabolic rate</CardTitle>
        </CardHeader>
        <CardContent>
          <RmrCard test={test} />
        </CardContent>
      </Card>

      <TdeeCard rmrKcal={test.rmr_kcal} activityLevel={activityLevel} />

      {test.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{test.notes}</CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        TDEE and calorie targets are estimates derived from your RMR and activity level,
        not medical advice.
      </p>
    </PageContainer>
  )
}
