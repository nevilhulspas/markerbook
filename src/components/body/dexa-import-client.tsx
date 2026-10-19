'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { FileText, Loader2, Scale, Upload, X } from 'lucide-react'
import { toast } from 'sonner'

import {
  extractDexaReport,
  saveDexaScan,
  type DexaExtractionResponse,
} from '@/actions/dexa-import'
import type { DexaExtraction, DexaScanExtract } from '@/lib/validations/dexa-import'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Phase = 'idle' | 'extracting' | 'review' | 'saving'

const MAX_FILES = 5

// Headline numeric fields the reviewer can correct before saving.
const EDIT_FIELDS: { key: keyof DexaScanExtract; label: string }[] = [
  { key: 'body_fat_pct', label: 'Body fat %' },
  { key: 'total_mass_kg', label: 'Total mass (kg)' },
  { key: 'lean_mass_g', label: 'Lean mass (g)' },
  { key: 'visceral_fat_g', label: 'Visceral fat (g)' },
  { key: 'ffmi', label: 'FFMI' },
  { key: 'almi', label: 'ALMI' },
  { key: 'bone_t_score', label: 'Bone T-score' },
]

export function DexaImportClient() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [files, setFiles] = useState<File[]>([])
  const [scan, setScan] = useState<DexaScanExtract | null>(null)
  const [regionCount, setRegionCount] = useState(0)
  const [extraction, setExtraction] = useState<DexaExtraction | null>(null)
  const [storagePath, setStoragePath] = useState<string | undefined>()
  // Number of files the saved record was merged from (set at extraction time).
  const [mergedFrom, setMergedFrom] = useState(1)

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
        toast.error(`Up to ${MAX_FILES} files per scan.`)
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
    const result: DexaExtractionResponse = await extractDexaReport(fd)

    if (!result.success) {
      toast.error(result.error)
      setPhase('idle')
      return
    }
    setExtraction(result.data)
    setScan(result.data.scan)
    setRegionCount(result.data.regions.length)
    setStoragePath(result.storagePath)
    setMergedFrom(files.length)
    setPhase('review')
  }

  function setField(key: keyof DexaScanExtract, raw: string) {
    setScan((s) => {
      if (!s) return s
      if (key === 'scan_date' || key === 'provider') return { ...s, [key]: raw }
      const n = raw === '' ? null : Number(raw)
      return { ...s, [key]: Number.isFinite(n as number) ? n : null }
    })
  }

  async function handleSave() {
    if (!extraction || !scan) return
    setPhase('saving')
    const result = await saveDexaScan({
      extraction: { ...extraction, scan },
      storagePath,
      source: mergedFrom > 1 ? 'merged' : 'summary',
    })
    if (result.success) {
      toast.success('DEXA scan saved')
      router.push(`/body/${result.scanId}`)
    } else {
      toast.error(result.error)
      setPhase('review')
    }
  }

  if ((phase === 'review' || phase === 'saving') && scan) {
    return (
      <div className="max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Review extracted scan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="scan_date">Scan date</Label>
                <Input id="scan_date" type="date" value={scan.scan_date} onChange={(e) => setField('scan_date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="provider">Provider</Label>
                <Input id="provider" value={scan.provider ?? ''} onChange={(e) => setField('provider', e.target.value)} />
              </div>
              {EDIT_FIELDS.map((f) => (
                <div key={String(f.key)} className="space-y-1.5">
                  <Label htmlFor={String(f.key)}>{f.label}</Label>
                  <Input
                    id={String(f.key)}
                    inputMode="decimal"
                    value={scan[f.key] == null ? '' : String(scan[f.key])}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              {mergedFrom > 1 && <span className="text-foreground">Merged {mergedFrom} files. </span>}
              Extracted <strong className="text-foreground">{regionCount}</strong> regional
              measurements. You can fine-tune everything after saving.
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={phase === 'saving'}>
                {phase === 'saving' && <Loader2 className="size-4 animate-spin" />}
                Save scan
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setExtraction(null)
                  setScan(null)
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
            <p className="font-medium">Extracting your scan…</p>
            <p className="text-sm text-muted-foreground">
              Reading {files.length > 1 ? `and merging ${files.length} files` : 'body composition, regions, and bone density'}. This can take ~30s — you can leave this page, it keeps going.
            </p>
          </>
        ) : (
          <>
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              {isDragActive ? <Upload className="size-6" /> : <Scale className="size-6" />}
            </div>
            <p className="font-medium">Drag &amp; drop your DEXA scan file(s)</p>
            <p className="text-sm text-muted-foreground">or click to browse</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Add both the summary and the raw printout if you have them — they&apos;re merged into one scan. PDFs &amp; images up to 32MB.
            </p>
          </>
        )}
      </div>

      {files.length > 0 && !extracting && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={`${f.name}:${f.size}`} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
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
