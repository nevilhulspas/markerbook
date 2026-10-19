import { CaptureClient } from '@/components/nutrition/capture-client'

export const dynamic = 'force-dynamic'

export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<{ autostart?: string; prefill?: string }>
}) {
  const { autostart, prefill } = await searchParams
  return <CaptureClient autoStartToken={autostart ?? null} prefill={prefill ?? ''} />
}
