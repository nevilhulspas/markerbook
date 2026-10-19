import type { Metadata } from 'next'
import Link from 'next/link'
import { Microscope } from 'lucide-react'

import { getMicrobiomeTests } from '@/actions/microbiome-tests'
import { Button } from '@/components/ui/button'
import { MicrobiomeTestCard } from '@/components/microbiome/microbiome-test-card'

export const metadata: Metadata = {
  title: 'Microbiome Tests | Bloodmarkers',
}

export default async function MicrobiomeTestsPage() {
  const { data: tests, error } = await getMicrobiomeTests()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Microbiome Tests
          </h1>
          <p className="text-muted-foreground">
            Track your gut microbiome composition over time.
          </p>
        </div>
        <Button asChild>
          <Link href="/microbiome/import">
            <Microscope className="size-4" />
            Import Microbiome Test
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
          <Microscope className="mb-4 size-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">No microbiome tests yet</h2>
          <p className="mb-4 max-w-sm text-sm text-muted-foreground">
            Import your first stool-analysis report to track your gut
            microbiome over time.
          </p>
          <Button asChild>
            <Link href="/microbiome/import">
              <Microscope className="size-4" />
              Import Microbiome Test
            </Link>
          </Button>
        </div>
      )}

      {tests && tests.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tests.map((test) => (
            <MicrobiomeTestCard key={test.id} test={test} />
          ))}
        </div>
      )}
    </div>
  )
}
