import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { getOtherTest } from '@/actions/other-tests'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { OtherEditForm } from '@/components/other/other-edit-form'
import { notFoundOrAuthOutage } from '@/lib/supabase/session'

export default async function OtherTestEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const test = await getOtherTest(id)
  if (!test) return notFoundOrAuthOutage()

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/other/${id}`}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Edit test</h1>
      </div>

      <OtherEditForm test={test} />
    </PageContainer>
  )
}
