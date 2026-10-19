'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { FileText, FlaskConical, Loader2, Plus, Upload, X } from 'lucide-react'
import { toast } from 'sonner'

import {
  extractOtherReport,
  saveOtherTest,
  type OtherExtractionResponse,
} from '@/actions/other-import'
import type {
  OtherExtraction,
  OtherTestExtract,
  OtherValueExtract,
} from '@/lib/validations/other-import'
import { OTHER_OUTCOME_LABELS, OTHER_OUTCOME_OPTIONS } from '@/lib/other/display'
import type { OtherTestOutcome } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Phase = 'idle' | 'extracting' | 'review' | 'saving'

const MAX_FILES = 3

const emptyValue = (): OtherValueExtract => ({
  label: '',
  value: null,
  unit: null,
  flag: null,
})

export function OtherImportClient() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [files, setFiles] = useState<File[]>([])
  const [test, setTest] = useState<OtherTestExtract | null>(null)
  const [values, setValues] = useState<OtherValueExtract[]>([])
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
    const result: OtherExtractionResponse = await extractOtherReport(fd)

    if (!result.success) {
      toast.error(result.error)
      setPhase('idle')
      return
    }
    setTest(result.data.test)
    setValues(result.data.values)
    setStoragePath(result.storagePath)
    setPhase('review')
  }

  function setField(key: keyof OtherTestExtract, raw: string) {
    setTest((t) => {
      if (!t) return t
      if (key === 'outcome') return { ...t, outcome: raw as OtherTestOutcome }
      // Text fields: empty string clears optional ones to null (required ones keep '').
      const optional = key === 'provider' || key === 'result_summary' || key === 'notes'
      return { ...t, [key]: optional && raw === '' ? null : raw }
    })
  }

  function setValueField(i: number, key: keyof OtherValueExtract, raw: string) {
    setValues((rows) =>
      rows.map((row, j) => {
        if (j !== i) return row
        if (key === 'label') return { ...row, label: raw }
        return { ...row, [key]: raw === '' ? null : raw }
      })
    )
  }

  async function handleSave() {
    if (!test) return
    if (!test.test_name.trim() || !test.test_date) {
      toast.error('A test name and date are required.')
      return
    }
    setPhase('saving')
    // Drop reading rows the user left without a label.
    const cleanValues = values.filter((v) => v.label.trim() !== '')
    const extraction: OtherExtraction = { test, values: cleanValues }
    const result = await saveOtherTest({ extraction, storagePath, source: 'import' })
    if (result.success) {
      toast.success('Test saved')
      router.push(`/other/${result.testId}`)
    } else {
      toast.error(result.error)
      setPhase('review')
    }
  }

  if ((phase === 'review' || phase === 'saving') && test) {
    return (
      <div className="max-w-3xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Review extracted test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="test_name">Test name</Label>
                <Input
                  id="test_name"
                  value={test.test_name}
                  onChange={(e) => setField('test_name', e.target.value)}
                  placeholder="e.g. SIBO breath test"
                />
              </div>
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
                  placeholder="Lab / clinic"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="outcome">Result</Label>
                <Select
                  value={test.outcome}
                  onValueChange={(v) => setField('outcome', v)}
                >
                  <SelectTrigger id="outcome">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OTHER_OUTCOME_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {OTHER_OUTCOME_LABELS[o]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="result_summary">Result summary</Label>
                <Input
                  id="result_summary"
                  value={test.result_summary ?? ''}
                  onChange={(e) => setField('result_summary', e.target.value)}
                  placeholder="One-line result"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={test.notes ?? ''}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Anything else worth keeping"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Readings (optional)</Label>
              {values.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No individual readings — fine for a simple yes/no test.
                </p>
              )}
              {values.map((v, i) => (
                // Label takes its own full-width line on mobile; value/unit/flag/remove
                // wrap onto a second line. On sm+ everything sits on one row.
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Input
                    aria-label="Label"
                    className="min-w-0 basis-full sm:flex-1 sm:basis-0"
                    value={v.label}
                    onChange={(e) => setValueField(i, 'label', e.target.value)}
                    placeholder="Label"
                  />
                  <Input
                    aria-label="Value"
                    className="w-20"
                    value={v.value ?? ''}
                    onChange={(e) => setValueField(i, 'value', e.target.value)}
                    placeholder="Value"
                  />
                  <Input
                    aria-label="Unit"
                    className="w-16"
                    value={v.unit ?? ''}
                    onChange={(e) => setValueField(i, 'unit', e.target.value)}
                    placeholder="Unit"
                  />
                  <Input
                    aria-label="Flag"
                    className="w-16"
                    value={v.flag ?? ''}
                    onChange={(e) => setValueField(i, 'flag', e.target.value)}
                    placeholder="Flag"
                  />
                  <button
                    type="button"
                    aria-label="Remove reading"
                    onClick={() => setValues((rows) => rows.filter((_, j) => j !== i))}
                    className="flex size-9 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setValues((rows) => [...rows, emptyValue()])}
              >
                <Plus className="size-4" />
                Add reading
              </Button>
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
                  setValues([])
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
    <div className="max-w-3xl space-y-4">
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
            <p className="font-medium">Reading your test…</p>
            <p className="text-sm text-muted-foreground">
              Pulling out the name, date, result and any readings. This can take ~30s —
              you can leave this page, it keeps going.
            </p>
          </>
        ) : (
          <>
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              {isDragActive ? <Upload className="size-6" /> : <FlaskConical className="size-6" />}
            </div>
            <p className="font-medium">Drag &amp; drop your test report</p>
            <p className="text-sm text-muted-foreground">or click to browse</p>
            <p className="mt-2 text-xs text-muted-foreground">PDFs &amp; images up to 32MB.</p>
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
