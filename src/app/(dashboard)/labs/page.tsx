import type { Metadata } from 'next'

import { getApprovedLabsWithTestCount } from '@/actions/labs'
import { getFavoriteLabIds } from '@/actions/lab-favorites'
import { PageContainer } from '@/components/layout/page-container'
import { LabCard } from '@/components/labs/lab-card'
import { SuggestLabDialog } from '@/components/labs/suggest-lab-dialog'

export const metadata: Metadata = {
  title: 'Labs | Markerbook',
}

export default async function LabsPage() {
  const { data: labs, error: labsError } = await getApprovedLabsWithTestCount()
  const favIds = await getFavoriteLabIds()

  // Stable sort: favorited labs first, original order preserved within each group.
  const sortedLabs = [...(labs ?? [])].sort((a, b) => {
    const aFav = favIds.has(a.id) ? 0 : 1
    const bFav = favIds.has(b.id) ? 0 : 1
    return aFav - bFav
  })

  return (
    <PageContainer width="default" className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Labs</h1>
          <p className="text-muted-foreground">
            Browse approved labs and their available tests.
          </p>
        </div>
        <SuggestLabDialog />
      </div>

      {labsError ? (
        <p className="text-destructive">Could not load labs right now. Refresh to try again.</p>
      ) : sortedLabs.length === 0 ? (
        <p className="text-muted-foreground">No labs available yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedLabs.map((lab) => (
            <LabCard key={lab.id} lab={lab} favorited={favIds.has(lab.id)} />
          ))}
        </div>
      )}
    </PageContainer>
  )
}
