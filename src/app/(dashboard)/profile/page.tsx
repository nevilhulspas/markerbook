import type { Metadata } from 'next'
import Link from 'next/link'
import { Dna, Pill, Sparkles } from 'lucide-react'

import { APP_LOCALE } from '@/lib/locale'
import { getProfile } from '@/actions/profile'
import { getActiveSupplements } from '@/actions/supplements'
import { getGeneticProfile } from '@/actions/genetics'
import { getMedicalConditions } from '@/actions/medical-conditions'
import { listInsightsMemory } from '@/actions/insights-memory'
import { ProfileForm } from '@/components/profile/profile-form'
import { HealthContextForm } from '@/components/profile/health-context-form'
import { MedicalConditionsCard } from '@/components/profile/medical-conditions-card'
import { MemoryManager } from '@/components/profile/memory-manager'
import { ShortcutTokenCard } from '@/components/profile/shortcut-token-card'
import { AdminAccessCard } from '@/components/profile/admin-access-card'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/layout/page-container'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Profile | Markerbook',
}

export default async function ProfilePage() {
  const [
    { data: profile },
    { data: activeSupplements },
    geneticResult,
    medicalConditions,
    memoryFiles,
  ] = await Promise.all([
    getProfile(),
    getActiveSupplements(),
    getGeneticProfile(),
    getMedicalConditions(),
    listInsightsMemory(),
  ])

  const activeCount = activeSupplements?.length ?? 0
  const geneticProfile = geneticResult.data

  return (
    <PageContainer width="narrow" className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Your health information helps us provide personalized reference ranges
          and insights for your blood test results.
        </p>
      </div>

      <ProfileForm initialData={profile} />

      {/* Medical-history additions, all flow into the insights chat
          system prompt via formatProfile(). */}
      <MedicalConditionsCard conditions={medicalConditions} />
      <HealthContextForm initialData={profile} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="size-5" />
            Stack
          </CardTitle>
          <CardDescription>
            Your supplements, medicines, and protocols.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {activeCount} active item{activeCount !== 1 ? 's' : ''}
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/supplements">Manage Stack</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dna className="size-5" />
            Genetics
          </CardTitle>
          <CardDescription>
            Your DNA variants and genetic test results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {geneticProfile
                ? `${geneticProfile.snp_count.toLocaleString(APP_LOCALE)} SNPs imported${geneticProfile.source ? ` from ${geneticProfile.source}` : ''}`
                : 'No genetic data imported yet'}
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href={geneticProfile ? '/genetics' : '/genetics/import'}>
                {geneticProfile ? 'View Genetics' : 'Import Data'}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <ShortcutTokenCard />

      <AdminAccessCard initialAllowed={profile?.impersonatable ?? false} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            Chat memory
          </CardTitle>
          <CardDescription>
            Things Chat has remembered from your conversations (goals,
            preferences). Review each entry and remove anything that&apos;s
            wrong or out of date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MemoryManager files={memoryFiles} />
        </CardContent>
      </Card>
    </PageContainer>
  )
}
