import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeftIcon } from 'lucide-react'

import { PageContainer } from '@/components/layout/page-container'
import { getLibrary } from '@/actions/nutrition-library'
import { LibraryTabs } from '@/components/nutrition/library/library-tabs'
import type { InitialEdit } from '@/components/nutrition/library/library-tabs'

export const dynamic = 'force-dynamic'

function parseEditParam(raw: string | undefined): InitialEdit {
  if (!raw) return null
  if (raw.startsWith('recipe:')) {
    const id = raw.slice('recipe:'.length).trim()
    return id ? { kind: 'recipe', id } : null
  }
  if (raw.startsWith('custom:')) {
    const id = raw.slice('custom:'.length).trim()
    return id ? { kind: 'custom', id } : null
  }
  return null
}

export const metadata: Metadata = {
  title: 'Food library | Markerbook',
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>
}) {
  const { edit } = await searchParams
  const initialEdit = parseEditParam(edit)
  const { customFoods, recipes } = await getLibrary()

  return (
    <PageContainer width="wide" className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/nutrition"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back to Nutrition"
        >
          <ChevronLeftIcon className="size-5" />
        </Link>
        <h1 className="text-2xl font-semibold">Library</h1>
      </div>
      <LibraryTabs customFoods={customFoods} recipes={recipes} initialEdit={initialEdit} />
    </PageContainer>
  )
}
