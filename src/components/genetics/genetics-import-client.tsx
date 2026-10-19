'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Upload } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { importRawGenetics } from '@/actions/genetics'
import { APP_LOCALE } from '@/lib/locale'
import { Button } from '@/components/ui/button'

export function GeneticsImportClient() {
  const router = useRouter()
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<{
    snpCount: number
    healthSnpCount: number
    source: string | null
  } | null>(null)

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return

      const file = accepted[0]
      setIsImporting(true)
      setResult(null)

      const formData = new FormData()
      formData.set('file', file)

      const res = await importRawGenetics(formData)

      setIsImporting(false)

      if (res.success) {
        setResult({
          snpCount: res.snpCount ?? 0,
          healthSnpCount: res.healthSnpCount ?? 0,
          source: res.source ?? null,
        })
        toast.success(`Imported ${res.snpCount?.toLocaleString(APP_LOCALE)} SNPs`)
      } else {
        toast.error(res.error ?? 'Import failed')
      }
    },
    []
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxSize: 100 * 1024 * 1024, // 100MB (raw files can be large)
    maxFiles: 1,
    disabled: isImporting,
  })

  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-green-50 p-6 text-center dark:bg-green-950/30">
          <p className="text-lg font-semibold text-green-800 dark:text-green-400">
            Import complete
          </p>
          <p className="mt-1 text-sm text-green-700 dark:text-green-500">
            {result.snpCount.toLocaleString(APP_LOCALE)} SNPs imported
            {result.source && ` from ${result.source}`}
          </p>
          <p className="text-sm text-green-700 dark:text-green-500">
            {result.healthSnpCount} health-relevant variants identified
          </p>
        </div>
        <Button onClick={() => router.push('/genetics')}>
          View your genetic profile
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          isDragActive && 'border-primary bg-primary/5',
          isImporting && 'cursor-not-allowed opacity-60',
          !isDragActive && !isImporting && 'border-muted-foreground/25 hover:border-primary/50'
        )}
      >
        <input {...getInputProps()} />

        {isImporting ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Parsing genetic data... This may take a moment for large files.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="size-10 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-base font-medium">
                {isDragActive
                  ? 'Drop your file here'
                  : 'Drag & drop your genetic data file'}
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse
              </p>
            </div>
            <p className="text-xs text-muted-foreground/70">
              Supports 23andMe, AncestryDNA raw data (.txt, .csv) and lab exports (.xlsx)
            </p>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-muted/50 p-4">
        <p className="text-sm font-medium">How to get your raw data:</p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li><strong>23andMe:</strong> Settings → 23andMe Data → Download Raw Data</li>
          <li><strong>AncestryDNA:</strong> Settings → Download DNA Data</li>
          <li><strong>Other services:</strong> Export your raw genotype data as a .txt or .csv file</li>
        </ul>
      </div>
    </div>
  )
}
