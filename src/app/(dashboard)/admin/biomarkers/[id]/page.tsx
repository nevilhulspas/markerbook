import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { AdminBiomarker } from '@/actions/admin/biomarkers'
import { BiomarkerForm } from '@/components/admin/biomarker-form'
import { UnitManager } from '@/components/admin/unit-manager'
import { RangeManager } from '@/components/admin/range-manager'
import { VerificationTab } from '@/components/admin/verification-tab'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function BiomarkerEditPage({ params }: PageProps) {
  const { id } = await params

  // Create mode
  if (id === 'new') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href="/admin/biomarkers"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-2xl font-bold">Create Biomarker</h1>
        </div>
        <BiomarkerForm />
      </div>
    )
  }

  // Edit mode -- fetch the biomarker
  const { data, error } = await supabaseAdmin
    .from('biomarkers')
    .select('*, biomarker_units(*), reference_ranges(*), panels(*, systems(*))')
    .eq('id', id)
    .single()

  if (error || !data) {
    redirect('/admin/biomarkers')
  }

  const biomarker = data as AdminBiomarker

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/biomarkers"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-2xl font-bold">{biomarker.name}</h1>
        {biomarker.archived_at && (
          <Badge variant="secondary">Archived</Badge>
        )}
      </div>

      {/* Biomarker form */}
      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-4">Details</h2>
        <BiomarkerForm biomarker={biomarker} />
      </div>

      {/* Tabs for units and ranges */}
      <Tabs defaultValue="units">
        <TabsList>
          <TabsTrigger value="units">
            Units ({biomarker.biomarker_units.length})
          </TabsTrigger>
          <TabsTrigger value="ranges">
            Reference Ranges ({biomarker.reference_ranges.length})
          </TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
        </TabsList>
        <TabsContent value="units" className="mt-4">
          <UnitManager
            biomarkerId={biomarker.id}
            units={biomarker.biomarker_units}
          />
        </TabsContent>
        <TabsContent value="ranges" className="mt-4">
          <RangeManager
            biomarkerId={biomarker.id}
            ranges={biomarker.reference_ranges}
          />
        </TabsContent>
        <TabsContent value="verification" className="mt-4">
          <VerificationTab
            biomarkerId={biomarker.id}
            ranges={biomarker.reference_ranges}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
