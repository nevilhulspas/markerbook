'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { extractFromPdf } from '@/actions/pdf-import'
import type { BloodTestWithCount } from '@/actions/blood-tests'
import { FileReviewPanel } from '@/components/import/file-review-panel'
import { PdfDropzone } from '@/components/import/pdf-dropzone'
import { Button } from '@/components/ui/button'
import type { Biomarker } from '@/lib/database.types'
import type { BatchStatus, ImportFileItem } from '@/lib/multi-import/types'
import { cn } from '@/lib/utils'

interface MultiImportClientProps {
  biomarkers: Biomarker[]
  existingTests: BloodTestWithCount[]
}

export function MultiImportClient({
  biomarkers,
  existingTests,
}: MultiImportClientProps) {
  const [files, setFiles] = useState<ImportFileItem[]>([])
  const [batchStatus, setBatchStatus] = useState<BatchStatus>('idle')
  const [reviewingFileId, setReviewingFileId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const updateFile = useCallback(
    (id: string, updates: Partial<ImportFileItem>) => {
      setFiles((previousFiles) =>
        previousFiles.map((file) =>
          file.id === id ? { ...file, ...updates } : file
        )
      )
    },
    []
  )

  const processFile = useCallback(
    async (item: ImportFileItem) => {
      updateFile(item.id, {
        status: 'uploading',
        statusText: 'Uploading PDF...',
        error: null,
      })

      try {
        const formData = new FormData()
        formData.append('pdf', item.file)

        updateFile(item.id, {
          status: 'extracting',
          statusText: 'Extracting markers...',
        })

        const result = await extractFromPdf(formData)

        if (result.success) {
          updateFile(item.id, {
            status: 'complete',
            statusText: 'Ready for review',
            extractionResult: result.data,
            matchedMarkers: result.matched_markers,
            storagePath: result.storage_path,
            error: null,
            hasPartialData: false,
          })
          return
        }

        if (result.partial_data) {
          updateFile(item.id, {
            status: 'complete',
            statusText: 'Partial extraction ready for review',
            extractionResult: result.partial_data,
            matchedMarkers: result.matched_markers ?? [],
            storagePath: result.storage_path ?? null,
            error: result.error,
            hasPartialData: true,
          })
          return
        }

        updateFile(item.id, {
          status: 'error',
          statusText: 'Extraction failed',
          error: result.error,
        })
      } catch {
        updateFile(item.id, {
          status: 'error',
          statusText: 'Extraction failed',
          error: 'Unexpected error during extraction',
        })
      }
    },
    [updateFile]
  )

  // Warn before leaving if there are unsaved files
  useEffect(() => {
    const hasUnsavedWork = files.some(
      (f) => !f.saved && !f.discarded && f.status !== 'queued'
    )
    if (!hasUnsavedWork) return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [files])

  useEffect(() => {
    if (batchStatus !== 'processing') {
      return
    }

    const activeFile = files.find(
      (file) => file.status === 'uploading' || file.status === 'extracting'
    )
    if (activeFile) {
      return
    }

    const nextQueuedFile = files.find((file) => file.status === 'queued')
    if (nextQueuedFile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the effect is the queue driver: it starts the next queued file
      void processFile(nextQueuedFile)
      return
    }

    if (files.length > 0) {
      setBatchStatus('complete')
    }
  }, [batchStatus, files, processFile])

  const buildFileItems = useCallback(
    (acceptedFiles: File[]) =>
      acceptedFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        fileName: file.name,
        status: 'queued' as const,
        statusText: 'Waiting...',
        extractionResult: null,
        matchedMarkers: null,
        error: null,
        storagePath: null,
        hasPartialData: false,
        saved: false,
        discarded: false,
      })),
    []
  )

  const handleFilesAccepted = useCallback(
    (acceptedFiles: File[]) => {
      const items = buildFileItems(acceptedFiles)

      setFiles((currentFiles) => [...currentFiles, ...items])
      if (batchStatus === 'idle') {
        setReviewingFileId(null)
      }
      setBatchStatus('processing')
      toast.success(
        `${items.length} file${items.length === 1 ? '' : 's'} added to the import queue`
      )
    },
    [batchStatus, buildFileItems]
  )

  const handleImportMoreClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleImportMoreChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? [])
      if (selectedFiles.length > 0) {
        handleFilesAccepted(selectedFiles)
      }
      event.target.value = ''
    },
    [handleFilesAccepted]
  )

  const handleStartOver = useCallback(() => {
    const hasPendingReviews = files.some(
      (file) =>
        file.status === 'complete' &&
        !file.saved &&
        !file.discarded
    )

    if (
      hasPendingReviews &&
      !window.confirm('Some completed files have not been reviewed yet. Start over anyway?')
    ) {
      return
    }

    setFiles([])
    setBatchStatus('idle')
    setReviewingFileId(null)
  }, [files])

  const handleFileSaved = useCallback(
    (fileId: string, _testId: string) => {
      const updatedFiles = files.map((file) =>
        file.id === fileId
          ? {
              ...file,
              saved: true,
              discarded: false,
              statusText: 'Saved',
            }
          : file
      )

      setFiles(updatedFiles)

      const remainingReviewCount = updatedFiles.filter(
        (file) =>
          file.status === 'complete' &&
          !file.saved &&
          !file.discarded
      ).length

      if (remainingReviewCount > 0) {
        toast.success(
          `${remainingReviewCount} more file${remainingReviewCount === 1 ? '' : 's'} to review`
        )
      }

      setReviewingFileId(null)
    },
    [files]
  )

  const handleFileDiscarded = useCallback((fileId: string) => {
    setFiles(
      files.map((file) =>
        file.id === fileId
          ? {
              ...file,
              saved: false,
              discarded: true,
              statusText: 'Discarded',
            }
          : file
      )
    )

    toast.success('File discarded')
    setReviewingFileId(null)
  }, [files])

  const completedCount = files.filter((file) => file.status === 'complete').length
  const failedCount = files.filter((file) => file.status === 'error').length
  const savedCount = files.filter((file) => file.saved).length
  const discardedCount = files.filter((file) => file.discarded).length
  const pendingReviewCount = files.filter(
    (file) => file.status === 'complete' && !file.saved && !file.discarded
  ).length
  const activeIndex = files.findIndex(
    (file) => file.status === 'uploading' || file.status === 'extracting'
  )
  const processingPosition =
    activeIndex >= 0 ? activeIndex + 1 : Math.min(completedCount + failedCount, files.length)

  const summaryText =
    batchStatus === 'complete'
      ? `Complete: ${completedCount} succeeded, ${failedCount} failed`
      : `Processing ${Math.max(processingPosition, 1)} of ${files.length} files...`

  const reviewingFile =
    reviewingFileId === null
      ? null
      : files.find((file) => file.id === reviewingFileId) ?? null

  if (reviewingFile) {
    return (
      <FileReviewPanel
        item={reviewingFile}
        biomarkers={biomarkers}
        existingTests={existingTests}
        onSaved={handleFileSaved}
        onDiscarded={handleFileDiscarded}
        onBack={() => setReviewingFileId(null)}
      />
    )
  }

  if (batchStatus === 'idle' && files.length === 0) {
    return (
      <PdfDropzone
        onFilesAccepted={handleFilesAccepted}
        isProcessing={false}
      />
    )
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,application/pdf,image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={handleImportMoreChange}
      />

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <FileText className="size-5 text-primary" />
            <div>
              <p className="text-sm font-medium">{summaryText}</p>
              <p className="text-sm text-muted-foreground">
                Each PDF is processed independently, so one failure will not stop the rest.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleImportMoreClick}
          >
            <Plus className="size-4" />
            Import More Files
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {files.map((file) => {
          const isReviewable =
            file.status === 'complete' && !file.saved && !file.discarded

          return (
            <div
              key={file.id}
              className={cn(
                'rounded-lg border bg-card p-4 shadow-sm',
                file.status === 'queued' && 'border-l-4 border-l-slate-300',
                (file.status === 'uploading' || file.status === 'extracting') &&
                  'border-l-4 border-l-blue-500',
                file.status === 'complete' &&
                  !file.saved &&
                  !file.discarded &&
                  'border-l-4 border-l-emerald-500',
                file.saved && 'border-l-4 border-l-emerald-500',
                file.discarded && 'border-l-4 border-l-slate-400 opacity-75',
                file.status === 'error' && 'border-l-4 border-l-red-500'
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <StatusIcon
                    status={file.status}
                    saved={file.saved}
                    discarded={file.discarded}
                  />
                  <div className="min-w-0 space-y-1">
                    <p className={cn('font-medium break-words', file.discarded && 'line-through')}>
                      {file.fileName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {file.statusText}
                    </p>
                    {file.error && (
                      <p className="text-sm text-destructive">{file.error}</p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {file.saved && (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                      Saved
                    </span>
                  )}
                  {file.discarded && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      Discarded
                    </span>
                  )}
                  {isReviewable && (
                    <Button
                      variant="outline"
                      onClick={() => setReviewingFileId(file.id)}
                    >
                      Review
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {batchStatus === 'complete' && (
        <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm">
          <div className="space-y-1">
            <p className="font-medium">
              {savedCount} of {files.length} files saved.
              {' '}
              {discardedCount} discarded.
              {' '}
              {failedCount} failed.
            </p>
            <p className="text-sm text-muted-foreground">
              {pendingReviewCount > 0
                ? `${pendingReviewCount} completed file${pendingReviewCount === 1 ? '' : 's'} still need review.`
                : 'All completed files have been handled.'}
            </p>
          </div>

          <Button
            variant="outline"
            className="w-fit"
            onClick={handleStartOver}
          >
            <RotateCcw className="size-4" />
            Start Over
          </Button>
        </div>
      )}
    </div>
  )
}

function StatusIcon({
  status,
  saved,
  discarded,
}: {
  status: ImportFileItem['status']
  saved: boolean
  discarded: boolean
}) {
  if (saved) {
    return <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
  }

  if (discarded) {
    return <Trash2 className="mt-0.5 size-5 shrink-0 text-slate-500" />
  }

  if (status === 'uploading' || status === 'extracting') {
    return <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-blue-500" />
  }

  if (status === 'complete') {
    return <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
  }

  if (status === 'error') {
    return <XCircle className="mt-0.5 size-5 shrink-0 text-red-500" />
  }

  return <Clock className="mt-0.5 size-5 shrink-0 text-slate-400" />
}
