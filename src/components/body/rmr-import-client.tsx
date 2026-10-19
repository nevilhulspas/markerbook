'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { Flame, FileText, Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'

import {
  extractRmrReport,
  saveRmrTest,
  type RmrExtractionResponse,
} from '@/actions/rmr-import'
import type { RmrExtraction, RmrTestExtract } from '@/lib/validations/rmr-import'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Phase = 'idle' | 'extracting' | 'review' | 'saving'

// One test is usually a single report; allow a couple of pages just in case.
const MAX_FILES = 3

// Numeric fields the reviewer can correct before saving.
const EDIT_FIELDS: { key: keyof RmrTestExtract; label: string }[] = [
  { key: 'rmr_kcal', label: 'Measured RMR (kcal/day)' },
  { key: 'predicted_rmr_kcal', label: 'Predicted RMR (kcal/day)' },
  { key: 'rer', label: 'RER' },
  { key: 'fuel_carb_pct', label: 'Fuel — carbs %' },
  { key: 'fuel_fat_pct', label: 'Fuel — fat %' },
]

export function RmrImportClient() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [files, setFiles] = useState<File[]>([])
  const [test, setTest] = useState<RmrTestExtract | null>(null)
  const [storagePath, setStoragePath] = useState<string | undefined>()

  const onDrop = useCallback((accepted: File[], rejections: FileRejection[]) => {
    if (rejections.length > 0) {
      toast.error('Only PDF or image files up to 32MB are supported.')
    }
    if (accepted.length === 0) return
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`))
      const merged = [...prev]
      for (const f of accepted) {
        if (!seen.has(`${f.name}:${f.size}`)) merged.push(f)
      }
      if (merged.length > MAX_FILES) {
        toast.error(`Up to ${MAX_FILES} files per test.`)
        return merged.slice(0, MAX_FILES)
      }
      return merged
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxFiles: MAX_FILES,
    maxSize: 32 * 1024 * 1024,
    disabled: phase === 'extracting' || phase === 'saving',
  })

  async function handleProcess() {
    if (files.length === 0) return
    setPhase('extracting')
    const fd = new FormData()
    for (const f of files) fd.append('file', f)
    const result: RmrExtractionResponse = await extractRmrReport(fd)

    if (!result.success) {
      toast.error(result.error)
      setPhase('idle')
      return
    }
    setTest(result.data.test)
    setStoragePath(result.storagePath)
    setPhase('review')
  }

  function setField(key: keyof RmrTestExtract, raw: string) {
    setTest((t) => {
      if (!t) return t
      if (key === 'test_date' || key === 'provider') return { ...t, [key]: raw }
      const n = raw === '' ? null : Number(raw)
      return { ...t, [key]: Number.isFinite(n as number) ? n : null }
    })
  }

  async function handleSave() {
    if (!test) return
    setPhase('saving')
    const extraction: RmrExtraction = { test }
    const result = await saveRmrTest({ extraction, storagePath, source: 'import' })
    if (result.success) {
      toast.success('RMR test saved')
      router.push(`/body/rmr/${result.testId}`)
    } else {
      toast.error(result.error)
      setPhase('review')
    }
  }

  if ((phase === 'review' || phase === 'saving') && test) {
    return (
      <div className="max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Review extracted test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="test_date">Test date</Label>
                <Input
                  id="test_date"
                  type="date"
                  value={test.test_date}
                  onChange={(e) => setField('test_date', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="provider">Provider</Label>
                <Input
                  id="provider"
                  value={test.provider ?? ''}
                  onChange={(e) => setField('provider', e.target.value)}
                />
              </div>
              {EDIT_FIELDS.map((f) => (
                <div key={String(f.key)} className="space-y-1.5">
                  <Label htmlFor={String(f.key)}>{f.label}</Label>
                  <Input
                    id={String(f.key)}
                    inputMode="decimal"
                    value={test[f.key] == null ? '' : String(test[f.key])}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              Your calorie targets (TDEE) are derived from this RMR and your profile
              activity level — visible after saving. You can fine-tune everything later.
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={phase === 'saving'}>
                {phase === 'saving' && <Loader2 className="size-4 animate-spin" />}
                Save test
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setTest(null)
                  setPhase('idle')
                }}
              >
                Discard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const extracting = phase === 'extracting'

  return (
    <div className="max-w-2xl space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center transition-colors',
          isDragActive ? 'border-primary bg-primary/5' : 'hover:border-foreground/30',
          extracting && 'pointer-events-none opacity-70'
        )}
      >
        <input {...getInputProps()} />
        {extracting ? (
          <>
            <Loader2 className="mb-4 size-10 animate-spin text-muted-foreground" />
            <p className="font-medium">Extracting your RMR test…</p>
            <p className="text-sm text-muted-foreground">
              Reading resting metabolic rate, RER, and fuel mix. This can take ~30s —
              you can leave this page, it keeps going.
            </p>
          </>
        ) : (
          <>
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              {isDragActive ? <Upload className="size-6" /> : <Flame className="size-6" />}
            </div>
            <p className="font-medium">Drag &amp; drop your RMR test file(s)</p>
            <p className="text-sm text-muted-foreground">or click to browse</p>
            <p className="mt-2 text-xs text-muted-foreground">
              PDFs &amp; images up to 32MB.
            </p>
          </>
        )}
      </div>

      {files.length > 0 && !extracting && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div
              key={`${f.name}:${f.size}`}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs text-muted-foreground">
                {(f.size / 1024 / 1024).toFixed(1)} MB
              </span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <Button onClick={handleProcess}>
            Process {files.length} file{files.length > 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  )
}
