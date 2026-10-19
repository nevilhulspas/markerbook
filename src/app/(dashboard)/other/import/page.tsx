import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { OtherImportClient } from '@/components/other/other-import-client'

export const metadata: Metadata = { title: 'Import test | Blood Markers Tracker' }

export default function OtherImportPage() {
  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/other">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import a test</h1>
          <p className="text-muted-foreground">
            Upload a PDF or photo — we’ll read the name, date, result and any readings for
            you to confirm.
          </p>
        </div>
      </div>

      <OtherImportClient />
    </PageContainer>
  )
}
