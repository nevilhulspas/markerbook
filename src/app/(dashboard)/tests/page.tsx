import type { Metadata } from 'next'
import Link from 'next/link'
import { FlaskConical, Plus, Upload } from 'lucide-react'

import { getBloodTests } from '@/actions/blood-tests'
import { Button } from '@/components/ui/button'
import { TestCard } from '@/components/tests/test-card'

export const metadata: Metadata = {
  title: 'Blood Tests | Markerbook',
}

export default async function TestsPage() {
  const { data: tests, error } = await getBloodTests()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Blood Tests</h1>
          <p className="text-muted-foreground">
            View and manage your blood test history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/import">
              <Upload className="size-4" />
              Import
            </Link>
          </Button>
          <Button asChild>
            <Link href="/tests/new">
              <Plus className="size-4" />
              New Test
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {tests && tests.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <FlaskConical className="mb-4 size-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">No blood tests yet</h2>
          <p className="mb-4 max-w-sm text-sm text-muted-foreground">
            Start by creating your first blood test to track your biomarker
            values over time.
          </p>
          <Button asChild>
            <Link href="/tests/new">
              <Plus className="size-4" />
              Create First Test
            </Link>
          </Button>
        </div>
      )}

      {tests && tests.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tests.map((test) => (
            <TestCard key={test.id} test={test} />
          ))}
        </div>
      )}
    </div>
  )
}
