'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

// react-pdf is client-only — load the shared viewer with ssr disabled, exactly
// like the blood-test edit page does. Reuses the same zoom/pan PdfViewer.
const PdfViewer = dynamic(
  () => import('@/components/import/pdf-viewer').then((m) => m.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-11rem)] items-center justify-center rounded-lg border bg-muted/30">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
)

export function OtherPdfPanel({ url }: { url: string }) {
  return <PdfViewer file={url} />
}
