import { PhotoCaptureClient } from '@/components/nutrition/photo-capture-client'

export const dynamic = 'force-dynamic'

export default async function PhotoCapturePage({
  searchParams,
}: {
  searchParams: Promise<{ capture?: string }>
}) {
  const { capture } = await searchParams
  return <PhotoCaptureClient captureToken={capture ?? null} />
}
