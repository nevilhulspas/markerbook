'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { deleteRmrTest } from '@/actions/rmr'
import { Button } from '@/components/ui/button'

export function RmrDeleteButton({ testId }: { testId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!window.confirm('Delete this RMR test? This cannot be undone.')) return
    setBusy(true)
    const { error } = await deleteRmrTest(testId)
    if (error) {
      setBusy(false)
      toast.error(error)
      return
    }
    toast.success('RMR test deleted')
    router.push('/body')
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
