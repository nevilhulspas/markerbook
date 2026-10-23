import type { Metadata } from 'next'

import { getSuggestions } from '@/actions/admin/suggestions'
import { SuggestionQueue } from '@/components/admin/suggestion-queue'

export const metadata: Metadata = {
  title: 'Admin · Suggestions | Markerbook',
}

export default async function SuggestionsPage() {
  const { data: suggestions, error } = await getSuggestions({})

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Suggestion Review Queue</h1>
        <p className="text-muted-foreground">
          Review, approve, or reject user-submitted marker and unit suggestions.
        </p>
      </div>
      <SuggestionQueue suggestions={suggestions ?? []} error={error} />
    </div>
  )
}
