import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { getScan } from '@/actions/dexa'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { DexaEditForm } from '@/components/body/dexa-edit-form'
import { notFoundOrAuthOutage } from '@/lib/supabase/session'

export default async function DexaScanEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getScan(id)
  if (!detail) return notFoundOrAuthOutage()

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/body/${id}`}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Edit scan</h1>
      </div>

      <DexaEditForm scan={detail.scan} />
    </PageContainer>
  )
}
