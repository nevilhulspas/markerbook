import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/layout/page-container'
import { DexaImportClient } from '@/components/body/dexa-import-client'

export const metadata: Metadata = { title: 'Import DEXA scan | Bloodmarkers' }

export default function DexaImportPage() {
  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/body">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import DEXA scan</h1>
          <p className="text-muted-foreground">
            Upload your scan PDF — body composition, regional breakdown, and bone
            density are extracted automatically.
          </p>
        </div>
      </div>

      <DexaImportClient />
    </PageContainer>
  )
}
