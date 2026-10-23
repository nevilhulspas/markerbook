import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { getDutchTestDetail } from '@/actions/dutch-tests'
import { createClient } from '@/lib/supabase/server'
import type { Profile, ReferenceRange } from '@/lib/database.types'
import { toClientProfile } from '@/lib/profile/client-profile'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DutchDashboard } from '@/components/dutch/dutch-dashboard'
import { PageContainer } from '@/components/layout/page-container'
import { APP_LOCALE } from '@/lib/locale'
import { notFoundOrAuthOutage } from '@/lib/supabase/session'
import { getRequestUser } from '@/lib/supabase/request-user'

export const metadata: Metadata = {
  title: 'DUTCH Test Detail | Markerbook',
}

function formatDate(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString(APP_LOCALE, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function phaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    follicular: 'Follicular',
    luteal: 'Luteal',
    postmenopausal: 'Postmenopausal',
    oral_progesterone: 'Oral Progesterone',
    oral_contraceptive: 'Oral Contraceptive',
    male: 'Male',
    unknown: 'Unknown Phase',
  }
  return labels[phase] ?? phase
}

export default async function DutchTestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { data: test, error } = await getDutchTestDetail(id)

  if (error || !test) {
    return notFoundOrAuthOutage(error)
  }

  // Fetch user profile for sex-specific reference ranges
  const supabase = await createClient()
  const {
    data: { user },
  } = await getRequestUser()

  const { data: profile } = user
    ? await supabase.from('profiles').select('*').eq('id', user.id).single()
    : { data: null }

  // Fetch reference ranges for all markers in this test. DUTCH results point
  // at dutch_markers, whose ranges live in dutch_reference_ranges (not the
  // blood reference_ranges table).
  const biomarkerIds = [
    ...new Set(test.dutch_test_results.map((r) => r.biomarker_id)),
  ]
  const { data: refRanges } =
    biomarkerIds.length > 0
      ? await supabase
          .from('dutch_reference_ranges')
          .select('*')
          .in('biomarker_id', biomarkerIds)
      : { data: null }

  return (
    <PageContainer width="narrow" className="space-y-6">
      {/* Header with back button and test info */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link href="/dutch">
              <ArrowLeft className="size-4" />
              <span className="sr-only">Back to DUTCH tests</span>
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-bold tracking-tight">{test.name}</h1>
            <p className="text-muted-foreground">
              {formatDate(test.test_date)}
            </p>
          </div>
        </div>
        {test.menstrual_phase &&
          test.menstrual_phase !== 'unknown' && (
            <Badge variant="outline" className="self-start sm:self-auto">
              {phaseLabel(test.menstrual_phase)}
            </Badge>
          )}
      </div>

      {/* Dashboard */}
      <DutchDashboard
        test={test}
        profile={toClientProfile((profile as Profile) ?? null)}
        referenceRanges={(refRanges ?? []) as ReferenceRange[]}
      />
    </PageContainer>
  )
}
