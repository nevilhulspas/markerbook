import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { DutchImportClient } from '@/components/dutch/dutch-import-client'

export const metadata: Metadata = {
  title: 'Import DUTCH Test | Blood Markers Tracker',
}

export default async function DutchImportPage() {
  const supabase = await createClient()
  const { data: dutchBiomarkers, error } = await supabase
    .from('dutch_markers')
    .select('*')
    .order('category')
    .order('name')

  if (error || !dutchBiomarkers) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Import DUTCH Test
          </h1>
          <p className="text-muted-foreground">
            Upload your DUTCH test PDF to extract hormone metabolite values.
          </p>
        </div>
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load DUTCH biomarkers: {error?.message ?? 'Unknown error'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Import DUTCH Test
        </h1>
        <p className="text-muted-foreground">
          Upload your DUTCH test PDF to extract hormone metabolite values.
        </p>
      </div>

      <DutchImportClient
        // aliases is nullable in the table; the review screen spreads it.
        dutchBiomarkers={dutchBiomarkers.map((m) => ({ ...m, aliases: m.aliases ?? [] }))}
      />
    </div>
  )
}
