import { Skeleton } from '@/components/ui/skeleton'

/**
 * Shown inside the dashboard layout while a page's server reads run, so a
 * navigation shows a placeholder instead of an empty content area.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-9 w-48" />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  )
}
