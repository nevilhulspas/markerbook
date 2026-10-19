import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/layout/page-container'
import { RmrImportClient } from '@/components/body/rmr-import-client'

export const metadata: Metadata = { title: 'Import RMR test | Blood Markers Tracker' }

export default function RmrImportPage() {
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
          <h1 className="text-3xl font-bold tracking-tight">Import RMR test</h1>
          <p className="text-muted-foreground">
            Upload your RMR / metabolic test PDF or image to extract it automatically.
          </p>
        </div>
      </div>

      <RmrImportClient />
    </PageContainer>
  )
}
