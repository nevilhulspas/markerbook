import type { Metadata } from 'next'

import { PageContainer } from '@/components/layout/page-container'
import { getFoodLogById, getMealPhotoSignedUrl } from '@/actions/nutrition-food-logs'
import { FoodLogEditForm } from '@/components/nutrition/food-log-edit-form'
import { notFoundOrAuthOutage } from '@/lib/supabase/session'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Edit meal | Markerbook',
}

export default async function EditFoodLogPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const log = await getFoodLogById(id)
  if (!log) return notFoundOrAuthOutage()
  const photoUrl = log.image_path ? await getMealPhotoSignedUrl(log.image_path) : null
  return (
    <PageContainer width="narrow" className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit meal</h1>
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="Meal photo" className="mb-4 max-h-64 w-full rounded-lg object-cover" />
      )}
      <FoodLogEditForm log={log} />
    </PageContainer>
  )
}
