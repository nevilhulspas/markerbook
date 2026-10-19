'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { deleteOtherTest } from '@/actions/other-tests'
import { Button } from '@/components/ui/button'

export function OtherDeleteButton({ testId }: { testId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!window.confirm('Delete this test? This cannot be undone.')) return
    setBusy(true)
    const { error } = await deleteOtherTest(testId)
    if (error) {
      setBusy(false)
      toast.error(error)
      return
    }
    toast.success('Test deleted')
    router.push('/other')
  }

  return (
    <Button
      variant="outline"
      onClick={handleDelete}
      disabled={busy}
      className="text-destructive hover:text-destructive"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      Delete
    </Button>
  )
}
