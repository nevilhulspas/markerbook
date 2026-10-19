'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RotateCw } from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'

/**
 * Catches errors thrown by the group layouts themselves ((dashboard),
 * (capture)), e.g. an auth outage detected in the layout, which the
 * dashboard's own error.tsx cannot catch because it sits inside that layout.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const [isRetrying, startTransition] = useTransition()

  useEffect(() => {
    console.error('[app] layout failed to render', error)
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
