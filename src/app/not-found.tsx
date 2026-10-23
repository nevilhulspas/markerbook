import { NotFoundMessage } from '@/components/layout/not-found-message'

/**
 * Shown for URLs that match no route at all. It renders in the root layout
 * only (no sidebar); notFound() inside the dashboard uses
 * (dashboard)/not-found.tsx instead.
 */
export default function NotFound() {
  return (
    <div className="min-h-dvh px-4 pt-[calc(env(safe-area-inset-top)+3.5rem)]">
      <NotFoundMessage />
    </div>
  )
}
