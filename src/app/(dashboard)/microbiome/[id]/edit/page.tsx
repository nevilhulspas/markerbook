import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { getMicrobiomeTestDetail } from '@/actions/microbiome-tests'
import { Button } from '@/components/ui/button'
import { MicrobiomeEditForm } from '@/components/microbiome/microbiome-edit-form'
import { notFoundOrAuthOutage } from '@/lib/supabase/session'

export const metadata: Metadata = {
  title: 'Edit Microbiome Test | Bloodmarkers',
}

export default async function EditMicrobiomeTestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { data: test, error } = await getMicrobiomeTestDetail(id)
  if (error || !test) return notFoundOrAuthOutage(error)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/microbiome/${id}`}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Test</h1>
          <p className="text-muted-foreground">{test.name}</p>
        </div>
      </div>
      <MicrobiomeEditForm test={test} />
    </div>
  )
}
