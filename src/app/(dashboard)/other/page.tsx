import type { Metadata } from 'next'
import Link from 'next/link'
import { FileUp, FlaskConical } from 'lucide-react'

import { getOtherTests } from '@/actions/other-tests'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { OtherTestCard } from '@/components/other/other-test-card'

export const metadata: Metadata = { title: 'Other tests | Blood Markers Tracker' }

export default async function OtherTestsPage() {
  const tests = await getOtherTests()

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Other tests</h1>
          <p className="text-muted-foreground">
            Miscellaneous results — SIBO, intolerance panels, and anything that doesn’t fit
            the other categories.
          </p>
        </div>
        <Button asChild>
          <Link href="/other/import">
            <FileUp className="size-4" />
            Import test
          </Link>
        </Button>
      </div>

      {tests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FlaskConical className="size-8 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              No other tests yet. Import a PDF or photo and we’ll read the result for you.
            </p>
            <Button asChild>
              <Link href="/other/import">Import test</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {tests.map((test) => (
            <OtherTestCard key={test.id} test={test} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Interpretations are AI-generated and not medical advice.
      </p>
    </PageContainer>
  )
}
