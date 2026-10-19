import { getAdminBiomarkers } from '@/actions/admin/biomarkers'
import { BiomarkerList } from '@/components/admin/biomarker-list'

export default async function BiomarkersPage() {
  const { data, error } = await getAdminBiomarkers({ showArchived: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Biomarker Catalog</h1>
        <p className="text-muted-foreground">
          Manage biomarkers, units, and reference ranges.
        </p>
      </div>
      <BiomarkerList biomarkers={data ?? []} error={error} />
    </div>
  )
}
