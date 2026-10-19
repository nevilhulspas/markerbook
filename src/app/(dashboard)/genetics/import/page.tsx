import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { GeneticsImportClient } from '@/components/genetics/genetics-import-client'
import { throwIfAuthOutage } from '@/lib/supabase/auth-outage'
import { getRequestUser } from '@/lib/supabase/request-user'

export const metadata: Metadata = {
  title: 'Import Genetic Data | Blood Markers Tracker',
}

export default async function GeneticsImportPage() {
  const {
    data: { user },
    error: authError,
  } = await getRequestUser()
  throwIfAuthOutage(user, authError)
  if (!user) redirect('/login')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/genetics">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Import Genetic Data
          </h1>
          <p className="text-muted-foreground">
            Upload your raw genetic data file to analyze your DNA variants.
          </p>
        </div>
      </div>

      <GeneticsImportClient />
    </div>
  )
}
