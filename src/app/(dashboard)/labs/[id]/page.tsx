import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'

import { getLabDetail } from '@/actions/labs'
import { getFavoriteLabIds } from '@/actions/lab-favorites'
import { getNextToTestLists } from '@/actions/next-to-test/lists'
import { getLabTestListMembership } from '@/actions/next-to-test/lookup'
import { LabFavoriteButton } from '@/components/labs/lab-favorite-button'
import { LabTestsTable } from '@/components/labs/lab-tests-table'
import { LabImportStatus } from '@/components/labs/lab-import-status'
import { SuggestTestDialog } from '@/components/labs/suggest-test-dialog'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/layout/page-container'
import { notFoundOrAuthOutage } from '@/lib/supabase/session'

export const metadata: Metadata = {
  title: 'Lab Detail | Markerbook',
}

export default async function LabDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [detail, favIds] = await Promise.all([
    getLabDetail(id),
    getFavoriteLabIds(),
  ])

  if (!detail) {
    return notFoundOrAuthOutage()
  }

  const { lab, tests } = detail
  const subtitle = [lab.city, lab.country].filter(Boolean).join(' · ')

  // Only feeds the "add to list" picker: hide it rather than fail the page.
  const nextToTestLists = await getNextToTestLists().catch((err: unknown) => {
    console.error('[next-to-test] lists unavailable for the picker', err)
    return []
  })
  const labTestIds = tests.map((t) => t.id)
  const nextToTestMembership =
    nextToTestLists.length > 0
      ? await getLabTestListMembership(labTestIds)
      : {}
  const websiteUrl =
    lab.website && /^https?:\/\//i.test(lab.website) ? lab.website : null

  return (
    <PageContainer width="wide" className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/labs">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to labs</span>
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{lab.name}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
          {websiteUrl && (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
              Visit website
            </a>
          )}
        </div>
        <LabFavoriteButton labId={id} initialFavorited={favIds.has(id)} />
      </div>

      {lab.description && (
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          {lab.description}
        </div>
      )}

      {lab.status === 'pending' ? (
        <LabImportStatus labId={id} />
      ) : (
        <div className="space-y-4">
          {lab.status === 'approved' && (
            <div className="flex justify-end">
              <SuggestTestDialog labId={id} />
            </div>
          )}
          <LabTestsTable
            tests={tests}
            nextToTestLists={nextToTestLists.length > 0 ? nextToTestLists : undefined}
            nextToTestMembership={nextToTestMembership}
          />
        </div>
      )}
    </PageContainer>
  )
}
