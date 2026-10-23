import type { Metadata } from 'next'

import { CaptureClient } from '@/components/nutrition/capture-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Log food | Markerbook',
}

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ autostart?: string; prefill?: string }>
}) {
  const { autostart, prefill } = await searchParams
  return <CaptureClient autoStartToken={autostart ?? null} prefill={prefill ?? ''} />
}
