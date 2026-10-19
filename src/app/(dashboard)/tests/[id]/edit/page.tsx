import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import {
  getBiomarkers,
  getBloodTest,
  updateBloodTest,
} from '@/actions/blood-tests'
import { getPdfSignedUrl } from '@/actions/pdf-import'
import { Button } from '@/components/ui/button'
import { BloodTestForm } from '@/components/tests/blood-test-form'
import { EditTestPdfViewer } from '@/components/tests/edit-test-pdf-viewer'
import type { BloodTestFormValues } from '@/lib/validations/blood-test'
import { notFoundOrAuthOutage } from '@/lib/supabase/session'

export const metadata: Metadata = {
  title: 'Edit Blood Test | Bloodmarkers',
}

export default async function EditTestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [testResult, biomarkersResult] = await Promise.all([
    getBloodTest(id),
    getBiomarkers(),
  ])

  if (testResult.error || !testResult.data) {
    return notFoundOrAuthOutage(testResult.error)
  }

  if (biomarkersResult.error || !biomarkersResult.data) {
    return (
      <div className="space-y-6">
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load biomarkers: {biomarkersResult.error}
        </div>
      </div>
    )
  }

  const test = testResult.data
  const biomarkers = biomarkersResult.data

  // Get signed URL for the PDF if one exists
  let pdfUrl: string | null = null
  if (test.pdf_storage_path) {
    const result = await getPdfSignedUrl(test.pdf_storage_path)
    if ('url' in result && result.url) {
      pdfUrl = result.url
    }
  }

  const defaultValues: BloodTestFormValues = {
    name: test.name,
    test_date: test.test_date,
    sample_type: test.sample_type,
    notes: test.notes ?? undefined,
    markers: test.test_results.map((r) => ({
      biomarker_id: r.biomarker_id,
      value: r.value,
      unit: r.unit,
    })),
  }

  async function handleSubmit(values: BloodTestFormValues) {
    'use server'
    const result = await updateBloodTest(id, values)
    return {
      success: result.success,
      error: result.error,
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/tests/${id}`}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to test</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Edit Blood Test
          </h1>
          <p className="text-muted-foreground">
            Update the details and marker values for this test.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full min-w-0 lg:sticky lg:top-4 lg:w-[40%] lg:self-start">
          <EditTestPdfViewer testId={id} initialUrl={pdfUrl} />
        </div>
        <div className="w-full lg:w-[60%]">
          <BloodTestForm
            biomarkers={biomarkers}
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            submitLabel="Update Blood Test"
          />
        </div>
      </div>
    </div>
  )
}
