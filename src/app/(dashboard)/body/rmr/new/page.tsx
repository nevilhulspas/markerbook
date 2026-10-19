import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { RmrForm } from '@/components/body/rmr-form'

export const metadata: Metadata = { title: 'New RMR test | Blood Markers Tracker' }

export default function NewRmrTestPage() {
  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/body">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">New RMR test</h1>
      </div>

      <RmrForm />
    </PageContainer>
  )
}
