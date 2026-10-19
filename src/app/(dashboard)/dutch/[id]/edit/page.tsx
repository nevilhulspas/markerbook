import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { getDutchTestDetail } from '@/actions/dutch-tests'
import { Button } from '@/components/ui/button'
import { DutchEditForm } from '@/components/dutch/dutch-edit-form'
import { notFoundOrAuthOutage } from '@/lib/supabase/session'

export const metadata: Metadata = {
  title: 'Edit DUTCH Test | Markerbook',
}

export default async function EditDutchTestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { data: test, error } = await getDutchTestDetail(id)

  if (error || !test) {
    return notFoundOrAuthOutage(error)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dutch/${id}`}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Test</h1>
          <p className="text-muted-foreground">{test.name}</p>
        </div>
      </div>
      <DutchEditForm test={test} />
    </div>
  )
}
