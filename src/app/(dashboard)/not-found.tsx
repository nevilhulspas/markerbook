import { NotFoundMessage } from '@/components/layout/not-found-message'

/**
 * Shown inside the dashboard layout (sidebar kept) when a page in this group
 * calls notFound(), e.g. a test id that does not exist or is not the user's.
 */
export default function DashboardNotFound() {
  return <NotFoundMessage />
}
