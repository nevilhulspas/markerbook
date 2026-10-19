'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2 } from 'lucide-react'

import { getLabImportStatus, type LabImportState } from '@/actions/labs'

/**
 * Live import banner for a user-submitted (pending) lab. Polls the scrape job
 * while it runs; on success (published with tests) it refreshes the page so the
 * tests render; on failure / no-tests it shows a warning (the lab stays hidden).
 */
export function LabImportStatus({ labId }: { labId: string }) {
  const router = useRouter()
  const [state, setState] = useState<LabImportState>({ status: 'running', tests: 0 })
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    let timer: ReturnType<typeof setTimeout> | undefined

    async function poll() {
      const s = await getLabImportStatus(labId)
      if (!mountedRef.current) return
      setState(s)
      if (s.status === 'running' || s.status === null) {
        timer = setTimeout(poll, 3000)
      } else if (s.status === 'done' && s.tests > 0) {
        router.refresh() // lab just published with tests → show them
      }
    }
    void poll()

    return () => {
      mountedRef.current = false
      if (timer) clearTimeout(timer)
    }
  }, [labId, router])

  const failed = state.status === 'error' || (state.status === 'done' && state.tests === 0)

  if (failed) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium">We couldn&apos;t import this lab&apos;s tests.</p>
          <p className="text-amber-700/80 dark:text-amber-400/80">
            It won&apos;t be published until the catalogue can be read. Check that the
            website points to the lab&apos;s test list.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="text-muted-foreground flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
      <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
      <div>
        <p>Importing this lab&apos;s catalogue… this can take a minute.</p>
        <p className="text-muted-foreground/80">
          You can safely leave this page — the import keeps running in the
          background and the lab shows up in your Labs list once it&apos;s done.
        </p>
      </div>
    </div>
  )
}
