import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { getBiomarkers, createBloodTest } from '@/actions/blood-tests'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/layout/page-container'
import { BloodTestForm } from '@/components/tests/blood-test-form'
import type { BloodTestFormValues } from '@/lib/validations/blood-test'

export const metadata: Metadata = {
  title: 'New Blood Test | Markerbook',
}

export default async function NewTestPage() {
  const { data: biomarkers, error } = await getBiomarkers()

  if (error || !biomarkers) {
    return (
      <PageContainer width="narrow" className="space-y-6">
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      </PageContainer>
    )
  }

  async function handleSubmit(values: BloodTestFormValues) {
    'use server'
    const result = await createBloodTest(values)
    return {
      success: result.success,
      error: result.error,
    }
  }

  return (
    <PageContainer width="narrow" className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="shrink-0" asChild>
          <Link href="/tests">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to tests</span>
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-bold tracking-tight">New Blood Test</h1>
          <p className="text-muted-foreground">
            Add a new blood test and enter your marker values.
          </p>
        </div>
      </div>

      <BloodTestForm biomarkers={biomarkers} onSubmit={handleSubmit} />
    </PageContainer>
  )
}
