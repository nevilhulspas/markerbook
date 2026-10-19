'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RotateCw } from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'

/**
 * Shown inside the dashboard layout when a page throws while rendering, for
 * example when a database read fails. Keeps the sidebar so the user can move
 * on, instead of the framework's bare error screen.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const [isRetrying, startTransition] = useTransition()

  useEffect(() => {
    console.error('[dashboard] page failed to render', error)
  }, [error])

  // reset() alone re-renders from the payload that already holds the error;
  // refresh() asks the server to render the page (and re-run its reads) again.
  function retry() {
    startTransition(() => {
      router.refresh()
      reset()
    })
  }

  return (
    <PageContainer width="narrow" className="py-16">
      <div className="flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="size-10 text-destructive" />
        <h1 className="text-xl font-semibold">This page could not be loaded</h1>
        <p className="text-sm text-muted-foreground">
          Something went wrong while fetching your data. Your data is safe — please try again.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
        )}
        <Button onClick={retry} disabled={isRetrying}>
          <RotateCw className={isRetrying ? 'size-4 animate-spin' : 'size-4'} />
          Try again
        </Button>
      </div>
    </PageContainer>
  )
}
