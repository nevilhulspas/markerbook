import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { MicrobiomeImportClient } from '@/components/microbiome/microbiome-import-client'
import { isAiConfigured } from '@/lib/ai/config'

export const metadata: Metadata = {
  title: 'Import Microbiome Test | Markerbook',
}

export default function MicrobiomeImportPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/microbiome">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Import Microbiome Test
          </h1>
          <p className="text-muted-foreground">
            Upload a stool-analysis report — taxa, reference ranges, and scores
            are extracted automatically.
          </p>
        </div>
      </div>

      <MicrobiomeImportClient aiEnabled={isAiConfigured()} />
    </div>
  )
}
