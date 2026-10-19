import type { Metadata } from 'next'

import { adminListLabs } from '@/actions/admin/labs'
import { getAdminBiomarkers } from '@/actions/admin/biomarkers'
import { LabAdminTable } from '@/components/admin/labs/lab-admin-table'

export const metadata: Metadata = {
  title: 'Lab Directory | Bloodmarkers',
}

export default async function AdminLabsPage() {
  const labs = await adminListLabs()
  const { data: biomarkerData } = await getAdminBiomarkers({ showArchived: false })
  const biomarkers = (biomarkerData ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    short_name: b.short_name,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lab Directory</h1>
        <p className="text-muted-foreground">
          Manage labs, their offered tests, and the biomarkers each test covers.
        </p>
      </div>
      <LabAdminTable labs={labs} biomarkers={biomarkers} />
    </div>
  )
}
