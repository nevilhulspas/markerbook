import type { Metadata } from 'next'
import Link from 'next/link'
import { TestTube2 } from 'lucide-react'

import { getDutchTests } from '@/actions/dutch-tests'
import { Button } from '@/components/ui/button'
import { DutchTestCard } from '@/components/dutch/dutch-test-card'

export const metadata: Metadata = {
  title: 'DUTCH Tests | Blood Markers Tracker',
}

export default async function DutchTestsPage() {
  const { data: tests, error } = await getDutchTests()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DUTCH Tests</h1>
          <p className="text-muted-foreground">
            View and manage your DUTCH hormone test results.
          </p>
        </div>
        <Button asChild>
          <Link href="/dutch/import">
            <TestTube2 className="size-4" />
            Import DUTCH Test
          </Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {tests && tests.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <TestTube2 className="mb-4 size-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">No DUTCH tests yet</h2>
          <p className="mb-4 max-w-sm text-sm text-muted-foreground">
            Import your first DUTCH test to track your hormone metabolite
            values over time.
          </p>
          <Button asChild>
            <Link href="/dutch/import">
              <TestTube2 className="size-4" />
              Import DUTCH Test
            </Link>
          </Button>
        </div>
      )}

      {tests && tests.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tests.map((test) => (
            <DutchTestCard key={test.id} test={test} />
          ))}
        </div>
      )}
    </div>
  )
}
