import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'

import { APP_LOCALE } from '@/lib/locale'
import { getGeneticProfile, getHealthRelevantSnps } from '@/actions/genetics'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SnpSummary } from '@/components/genetics/snp-summary'
import { throwIfAuthOutage } from '@/lib/supabase/auth-outage'
import { getRequestUser } from '@/lib/supabase/request-user'

export const metadata: Metadata = {
  title: 'Genetics | Markerbook',
}

export default async function GeneticsPage() {
  const {
    data: { user },
    error: authError,
  } = await getRequestUser()
  throwIfAuthOutage(user, authError)
  if (!user) redirect('/login')

  const [profileResult, snpsResult] = await Promise.all([
    getGeneticProfile(),
    getHealthRelevantSnps(),
  ])

  const profile = profileResult.data
  const snps = snpsResult.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-bold tracking-tight">Genetics</h1>
          <p className="text-muted-foreground">
            Your DNA variants and their health implications.
          </p>
        </div>
        <Button asChild>
          <Link href="/genetics/import">
            <Plus className="size-4" />
            Import Genetic Data
          </Link>
        </Button>
      </div>

      {profile ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {profile.source && (
              <Badge variant="outline">{profile.source}</Badge>
            )}
            <Badge variant="secondary">
              {profile.snp_count.toLocaleString(APP_LOCALE)} SNPs
            </Badge>
            <Badge variant="secondary">
              {snps.length} health-relevant
            </Badge>
            <span className="text-sm text-muted-foreground">
              Imported {new Date(profile.import_date).toLocaleDateString(APP_LOCALE)}
            </span>
          </div>

          <SnpSummary snps={snps} />
        </div>
      ) : (
        <div className="flex h-[40vh] flex-col items-center justify-center space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight">
              No genetic data yet
            </h2>
            <p className="mt-2 text-muted-foreground">
              Import your 23andMe, AncestryDNA, or other genetic test results.
            </p>
          </div>
          <Button asChild>
            <Link href="/genetics/import">
              <Plus className="size-4" />
              Import Genetic Data
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
