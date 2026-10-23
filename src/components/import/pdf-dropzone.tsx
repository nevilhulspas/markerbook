'use client'

import { useCallback, useState } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { FileText, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

interface PdfDropzoneProps {
  onFilesAccepted: (files: File[]) => void
  isProcessing: boolean
  statusText?: string
  /** Switch the dropzone off, e.g. when AI reading is not set up on the server. */
  disabled?: boolean
}

const MAX_SIZE = 32 * 1024 * 1024 // 32MB

export function PdfDropzone({
  onFilesAccepted,
  isProcessing,
  statusText,
  disabled = false,
}: PdfDropzoneProps) {
  const [rejectionError, setRejectionError] = useState<string | null>(null)

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      setRejectionError(null)

      if (rejected.length > 0) {
        const messages = new Set<string>()

        for (const rejectedFile of rejected) {
          for (const error of rejectedFile.errors) {
            if (error.code === 'file-too-large') {
              messages.add('One or more files are too large. Maximum size is 32MB each.')
            } else if (error.code === 'file-invalid-type') {
              messages.add('Unsupported file type. Please upload PDFs or images (JPG, PNG, WebP).')
            } else {
              messages.add(error.message)
            }
          }
        }

        setRejectionError(Array.from(messages).join(' '))
        return
      }

      if (accepted.length > 0) {
        onFilesAccepted(accepted)
      }
    },
    [onFilesAccepted]
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
    maxSize: MAX_SIZE,
    disabled: isProcessing || disabled,
  })

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          'flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          isDragActive && 'border-primary bg-primary/5',
          (isProcessing || disabled) && 'cursor-not-allowed opacity-60',
          !isDragActive && !isProcessing && !disabled && 'border-muted-foreground/25 hover:border-primary/50'
        )}
      >
        <input {...getInputProps()} />

        {isProcessing ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-10 animate-spin text-primary" />
            {statusText && (
              <p className="text-sm text-muted-foreground">{statusText}</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <FileText className="size-10 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-base font-medium">
                {isDragActive
                  ? 'Drop your files here'
                  : 'Drag & drop your lab report PDFs or images here'}
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse
              </p>
            </div>
            <p className="text-xs text-muted-foreground/70">
              PDFs and images up to 32MB each
            </p>
          </div>
        )}
      </div>

      {rejectionError && (
        <p className="text-sm text-destructive">{rejectionError}</p>
      )}
    </div>
  )
}
