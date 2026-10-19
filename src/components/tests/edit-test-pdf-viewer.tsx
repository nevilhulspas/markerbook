'use client'

import { useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { FileText, Loader2, Upload } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'

import { attachPdfToTest } from '@/actions/blood-tests'
import { getPdfSignedUrl } from '@/actions/pdf-import'
import { cn } from '@/lib/utils'

const PdfViewer = dynamic(
  () => import('@/components/import/pdf-viewer').then((m) => m.PdfViewer),
  { ssr: false }
)

interface EditTestPdfViewerProps {
  testId: string
  initialUrl: string | null
}

export function EditTestPdfViewer({ testId, initialUrl }: EditTestPdfViewerProps) {
  const router = useRouter()
  const [pdfUrl, setPdfUrl] = useState(initialUrl)
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0]
      if (!file) return

      setIsUploading(true)
      const formData = new FormData()
      formData.append('pdf', file)

      const result = await attachPdfToTest(testId, formData)

      if (result.success) {
        const urlResult = await getPdfSignedUrl(result.storagePath)
        if ('url' in urlResult && urlResult.url) {
          setPdfUrl(urlResult.url)
        }
        toast.success('PDF attached')
        router.refresh()
      } else {
        toast.error(result.error)
      }

      setIsUploading(false)
    },
    [testId, router]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif'],
    },
    maxFiles: 1,
    maxSize: 32 * 1024 * 1024,
    disabled: isUploading,
  })

  if (pdfUrl) {
    return <PdfViewer file={pdfUrl} />
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors',
        isDragActive && 'border-primary bg-primary/5',
        isUploading && 'cursor-not-allowed opacity-60',
        !isDragActive && !isUploading && 'border-muted-foreground/25 hover:border-primary/50'
      )}
    >
      <input {...getInputProps()} />
      {isUploading ? (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Uploading PDF...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          {isDragActive ? (
            <Upload className="size-8 text-primary" />
          ) : (
            <FileText className="size-8 text-muted-foreground" />
          )}
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {isDragActive ? 'Drop PDF here' : 'Attach lab report PDF'}
            </p>
            <p className="text-xs text-muted-foreground">
              Drag & drop or click to browse
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
