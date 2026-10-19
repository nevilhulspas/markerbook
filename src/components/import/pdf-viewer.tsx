'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Loader2, Minus, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface PdfViewerProps {
  file: File | string
}

const MIN_ZOOM = 0.6
const MAX_ZOOM = 2
const ZOOM_STEP = 0.2
const DEFAULT_ZOOM = 0.85

function isImageFile(file: File | string): boolean {
  if (typeof file === 'string') {
    return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(file)
  }
  return file.type.startsWith('image/')
}

export const PdfViewer = memo(function PdfViewer({ file }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [baseWidth, setBaseWidth] = useState<number | null>(null)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [isDragging, setIsDragging] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragState = useRef({ startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 })

  const isImage = isImageFile(file)

  useEffect(() => {
    if (!isImage) {
      setImageUrl(null)
      return
    }
    if (typeof file === 'string') {
      setImageUrl(file)
      return
    }
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file, isImage])

  // Measure the container width exactly once on mount
  const measuredRef = useCallback((node: HTMLDivElement | null) => {
    if (node && !baseWidth) {
      setBaseWidth(node.clientWidth)
      scrollRef.current = node
    }
  }, [baseWidth])

  const pageWidth = Math.max((baseWidth ?? 500) - 32, 260)
  const isZoomedIn = zoom > DEFAULT_ZOOM

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isZoomedIn || !scrollRef.current) return
    // Don't intercept clicks on buttons/inputs
    if ((e.target as HTMLElement).closest('button, input, a')) return

    setIsDragging(true)
    scrollRef.current.setPointerCapture(e.pointerId)
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: scrollRef.current.scrollLeft,
      scrollTop: scrollRef.current.scrollTop,
    }
  }, [isZoomedIn])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !scrollRef.current) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    scrollRef.current.scrollLeft = dragState.current.scrollLeft - dx
    scrollRef.current.scrollTop = dragState.current.scrollTop - dy
  }, [isDragging])

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  return (
    <div
      className="rounded-lg border bg-muted/30"
      style={{ contain: 'inline-size' }}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-3 py-2 backdrop-blur">
        <p className="text-xs text-muted-foreground">
          Zoom {Math.round(zoom * 100)}%
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM))}
            disabled={zoom <= MIN_ZOOM}
          >
            <Minus className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setZoom(DEFAULT_ZOOM)}
            disabled={zoom === DEFAULT_ZOOM}
          >
            Reset
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM))}
            disabled={zoom >= MAX_ZOOM}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <div
        ref={measuredRef}
        className="h-[calc(100vh-11rem)] overflow-auto select-none"
        style={{ cursor: isZoomedIn ? (isDragging ? 'grabbing' : 'grab') : undefined }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {isImage ? (
          <div className="p-4">
            {imageUrl ? (
              <div
                style={{
                  width: pageWidth * zoom,
                }}
              >
                <div
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                    width: pageWidth,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- an object URL of the uploaded file or a signed storage URL; next/image cannot optimise either */}
                  <img
                    src={imageUrl}
                    alt="Lab report"
                    style={{ width: pageWidth, height: 'auto', display: 'block' }}
                    className="shadow-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        ) : (
          <Document
            file={file}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            loading={
              <div className="flex min-h-[400px] items-center justify-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            }
          >
          {Array.from({ length: numPages }, (_, index) => (
            <div key={index} className="p-4">
              {index > 0 && (
                <div className="py-2 text-xs text-muted-foreground">
                  Page {index + 1} of {numPages}
                </div>
              )}
              <div
                style={{
                  width: pageWidth * zoom,
                  height: pageWidth * 1.414 * zoom,
                }}
              >
                <div
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                    width: pageWidth,
                  }}
                >
                  <Page
                    pageNumber={index + 1}
                    width={pageWidth}
                    className="shadow-sm"
                  />
                </div>
              </div>
            </div>
          ))}
            {numPages > 0 && (
              <div className="py-2 text-center text-xs text-muted-foreground">
                {numPages === 1 ? '1 page' : `Page ${numPages} of ${numPages}`}
              </div>
            )}
          </Document>
        )}
      </div>
    </div>
  )
})
