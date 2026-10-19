import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { getRmrTest } from '@/actions/rmr'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { RmrForm } from '@/components/body/rmr-form'
import { notFoundOrAuthOutage } from '@/lib/supabase/session'

export default async function RmrTestEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const test = await getRmrTest(id)
  if (!test) return notFoundOrAuthOutage()

  return (
    <PageContainer className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/body/rmr/${id}`}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Edit RMR test</h1>
      </div>

      <RmrForm test={test} />
    </PageContainer>
  )
}
