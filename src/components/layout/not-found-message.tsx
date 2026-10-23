import Link from 'next/link'
import { SearchX } from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'

/** Shared body of the 404 pages (inside the dashboard and at the app root). */
export function NotFoundMessage() {
  return (
    <PageContainer width="narrow" className="py-16">
      <div className="flex flex-col items-center gap-4 text-center">
        <SearchX className="size-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">We could not find that page</h1>
        <p className="text-sm text-muted-foreground">
          The link may be out of date, or the item may have been deleted.
        </p>
        <Button asChild>
          <Link href="/dashboard">Back to the dashboard</Link>
        </Button>
      </div>
    </PageContainer>
  )
}
