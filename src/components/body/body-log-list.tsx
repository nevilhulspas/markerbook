'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { deleteLogEntry } from '@/actions/body-log'
import type { BodyLogEntry } from '@/lib/database.types'
import { APP_LOCALE } from '@/lib/locale'

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(APP_LOCALE, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function BodyLogList({ entries }: { entries: BodyLogEntry[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No measurements logged yet.</p>
  }

  async function handleDelete(id: string) {
    setBusy(id)
    const { error } = await deleteLogEntry(id)
    setBusy(null)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Entry deleted')
    router.refresh()
  }

  return (
    <div className="space-y-1.5">
      {entries.map((e) => (
        <div key={e.id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
          <span className="w-24 shrink-0 text-muted-foreground">{fmt(e.logged_on)}</span>
          <span className="flex flex-1 flex-wrap gap-x-4 gap-y-0.5 tabular-nums">
            {e.weight_kg != null && <span>{e.weight_kg} kg</span>}
            {e.body_fat_pct != null && <span>{e.body_fat_pct}% fat</span>}
            {e.waist_cm != null && <span>{e.waist_cm} cm waist</span>}
          </span>
          <button
            type="button"
            onClick={() => handleDelete(e.id)}
            disabled={busy === e.id}
            aria-label="Delete entry"
            className="text-muted-foreground hover:text-foreground"
          >
            {busy === e.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </button>
        </div>
      ))}
    </div>
  )
}
