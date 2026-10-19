import type { Metadata } from 'next'

import { getBiomarkers, getBloodTests } from '@/actions/blood-tests'
import { MultiImportClient } from '@/components/import/multi-import-client'

export const metadata: Metadata = {
  title: 'Import Lab Reports | Blood Markers Tracker',
}

export default async function ImportPage() {
  const [biomarkersResult, testsResult] = await Promise.all([
    getBiomarkers(),
    getBloodTests(),
  ])
  const { data: biomarkers, error } = biomarkersResult
  const existingTests = testsResult.data ?? []

  if (error || !biomarkers) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Import Lab Reports
          </h1>
          <p className="text-muted-foreground">
            Upload lab PDFs or images to automatically extract your blood marker values.
          </p>
        </div>
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load biomarkers: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Import Lab Reports
        </h1>
        <p className="text-muted-foreground">
          Upload lab PDFs or images to automatically extract your blood marker values.
        </p>
      </div>

      <MultiImportClient biomarkers={biomarkers} existingTests={existingTests} />
    </div>
  )
}
