'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { Loader2, Microscope, Upload } from 'lucide-react'
import { toast } from 'sonner'

import {
  extractMicrobiomeReport,
  saveMicrobiomeReport,
  type MicrobiomeExtractionResponse,
} from '@/actions/microbiome-import'
import type { MicrobiomeExtraction } from '@/lib/validations/microbiome-import'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Phase = 'idle' | 'extracting' | 'review' | 'saving'

export function MicrobiomeImportClient() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [extraction, setExtraction] = useState<MicrobiomeExtraction | null>(
    null
  )
  const [storagePath, setStoragePath] = useState<string | undefined>()
  const [name, setName] = useState('')
  const [testDate, setTestDate] = useState('')
  const [labName, setLabName] = useState('')

  const onDrop = useCallback(
    async (accepted: File[], rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        toast.error('Only PDF or image files up to 32MB are supported.')
        return
      }
      const file = accepted[0]
      if (!file) return

      setPhase('extracting')
      const fd = new FormData()
      fd.append('file', file)
      const result: MicrobiomeExtractionResponse =
        await extractMicrobiomeReport(fd)

      if (!result.success) {
        toast.error(result.error)
        setPhase('idle')
        return
      }

      setExtraction(result.data)
      setStoragePath(result.storagePath)
      setName(result.data.test.name)
      setTestDate(result.data.test.test_date)
      setLabName(result.data.test.lab_name ?? '')
      setPhase('review')
    },
    []
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxFiles: 1,
    maxSize: 32 * 1024 * 1024,
    disabled: phase === 'extracting' || phase === 'saving',
  })

  async function handleSave() {
    if (!extraction) return
    setPhase('saving')
    const result = await saveMicrobiomeReport({
      extraction: {
        ...extraction,
        test: {
          ...extraction.test,
          name: name || extraction.test.name,
          test_date: testDate || extraction.test.test_date,
          lab_name: labName || null,
        },
      },
      storagePath,
    })
    if (result.success) {
      toast.success('Microbiome test imported')
      router.push(`/microbiome/${result.testId}`)
    } else {
      toast.error(result.error)
      setPhase('review')
    }
  }

  if ((phase === 'review' || phase === 'saving') && extraction) {
    const abnormal = extraction.results.filter(
      (r) => r.status === 'low' || r.status === 'high'
    ).length
    return (
      <div className="max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Review extracted report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="name">Test Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Test Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lab">Lab</Label>
                <Input
                  id="lab"
                  value={labName}
                  onChange={(e) => setLabName(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              Extracted <strong>{extraction.results.length}</strong> taxa
              {abnormal > 0 && (
                <>
                  {' '}
                  (<span className="text-amber-600">{abnormal} flagged</span>)
                </>
              )}{' '}
              and <strong>{extraction.scores.length}</strong> scores.
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={phase === 'saving'}>
                {phase === 'saving' && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Save test
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setExtraction(null)
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

  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center transition-colors',
        isDragActive ? 'border-primary bg-primary/5' : 'hover:border-foreground/30',
        phase === 'extracting' && 'pointer-events-none opacity-70'
      )}
    >
      <input {...getInputProps()} />
      {phase === 'extracting' ? (
        <>
          <Loader2 className="mb-4 size-10 animate-spin text-muted-foreground" />
          <p className="font-medium">Extracting your report…</p>
          <p className="text-sm text-muted-foreground">
            Reading taxa, reference ranges, and scores. This can take ~30s.
          </p>
        </>
      ) : (
        <>
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            {isDragActive ? (
              <Upload className="size-6" />
            ) : (
              <Microscope className="size-6" />
            )}
          </div>
          <p className="font-medium">
            Drag & drop your microbiome report PDF or image
          </p>
          <p className="text-sm text-muted-foreground">or click to browse</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Biovis, GI-MAP, GenovaGI, BiomeSight — PDFs and images up to 32MB
          </p>
        </>
      )}
    </div>
  )
}
