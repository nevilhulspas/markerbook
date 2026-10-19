'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { ArrowLeft, AlertTriangle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  appendResultsToBloodTest,
  createBloodTest,
  type BloodTestWithCount,
} from '@/actions/blood-tests'
import {
  ExtractionReview,
  type ImportMetadata,
} from '@/components/import/extraction-review'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Biomarker } from '@/lib/database.types'
import type { MatchedMarker } from '@/lib/extraction/types'
import { withRowIds } from '@/lib/import/marker-list-ops'
import { prepareMarkersForSave } from '@/lib/import/prepare-markers-for-save'
import type { ImportFileItem } from '@/lib/multi-import/types'
import { APP_LOCALE } from '@/lib/locale'

const PdfViewer = dynamic(
  () => import('@/components/import/pdf-viewer').then((m) => m.PdfViewer),
  { ssr: false }
)

interface FileReviewPanelProps {
  item: ImportFileItem
  biomarkers: Biomarker[]
  existingTests: BloodTestWithCount[]
  onSaved: (fileId: string, testId: string) => void
  onDiscarded: (fileId: string) => void
  onBack: () => void
}

function formatTestDate(dateString: string): string {
  return new Date(dateString + 'T00:00:00').toLocaleDateString(APP_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatToday(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function FileReviewPanel({
  item,
  biomarkers,
  existingTests,
  onSaved,
  onDiscarded,
  onBack,
}: FileReviewPanelProps) {
  // Stable row ids so review rows keep their own state through moves/inserts.
  const [matchedMarkers, setMatchedMarkers] = useState<MatchedMarker[]>(() =>
    withRowIds(item.matchedMarkers ?? [])
  )
  const [isSaving, setIsSaving] = useState(false)
  const [target, setTarget] = useState<'new' | 'existing'>('new')
  const [targetTestId, setTargetTestId] = useState<string>('')

  async function handleSave(metadata: ImportMetadata) {
    const { markers, duplicateNames } = prepareMarkersForSave(matchedMarkers)

    if (duplicateNames.length > 0) {
      toast.error(
        `Some markers are mapped more than once: ${duplicateNames.join(', ')}. Keep only one selection for each before saving.`
      )
      return
    }

    if (target === 'existing' && !targetTestId) {
      toast.error('Pick the existing test to add to.')
      return
    }

    setIsSaving(true)

    if (target === 'existing') {
      const result = await appendResultsToBloodTest(targetTestId, markers)
      setIsSaving(false)
      if (result.success) {
        const summary =
          result.added && result.replaced
            ? `${result.added} added, ${result.replaced} updated`
            : result.added
              ? `${result.added} added`
              : result.replaced
                ? `${result.replaced} updated`
                : 'No changes'
        toast.success(`Imported into existing test (${summary})`)
        onSaved(item.id, result.testId)
        return
      }
      toast.error(result.error ?? 'Failed to add results to existing test')
      return
    }

    const result = await createBloodTest({
      name: metadata.testName || 'Imported Lab Report',
      test_date: metadata.date || formatToday(),
      sample_type: metadata.sampleType,
      pdf_storage_path: item.storagePath ?? undefined,
      markers,
    })

    setIsSaving(false)

    if (result.success) {
      toast.success('Blood test imported successfully')
      onSaved(item.id, result.testId)
      return
    }

    toast.error(result.error ?? 'Failed to save blood test')
  }

  if (!item.extractionResult) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" className="w-fit px-0" onClick={onBack}>
            <ArrowLeft className="size-4" />
            Back to queue
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">Review extracted report</p>
            <h2 className="text-xl font-semibold">{item.fileName}</h2>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-fit text-destructive hover:text-destructive"
          onClick={() => onDiscarded(item.id)}
        >
          <Trash2 className="size-4" />
          Discard
        </Button>
      </div>

      {item.hasPartialData && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-200">
          <AlertTriangle className="size-4 shrink-0" />
          Some markers could not be extracted. You can add missing values manually.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-sm">
        <span className="font-medium">Save to</span>
        <RadioGroup
          value={target}
          onValueChange={(val) => setTarget(val as 'new' | 'existing')}
          className="flex flex-wrap items-center gap-4"
        >
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="new" id="target-new" />
            <Label htmlFor="target-new" className="cursor-pointer font-normal">
              New test
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem
              value="existing"
              id="target-existing"
              disabled={existingTests.length === 0}
            />
            <Label
              htmlFor="target-existing"
              className="cursor-pointer font-normal"
            >
              Existing test
              {existingTests.length === 0 && (
                <span className="ml-1 text-xs text-muted-foreground">
                  (none yet)
                </span>
              )}
            </Label>
          </div>
        </RadioGroup>

        {target === 'existing' && existingTests.length > 0 && (
          <Select value={targetTestId} onValueChange={setTargetTestId}>
            <SelectTrigger
              id="target-test"
              className="ml-auto h-8 w-full sm:w-72"
            >
              <SelectValue placeholder="Pick a test..." />
            </SelectTrigger>
            <SelectContent>
              {existingTests.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} — {formatTestDate(t.test_date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full min-w-0 lg:sticky lg:top-4 lg:w-[40%] lg:self-start">
          <PdfViewer file={item.file} />
        </div>

        <div className="w-full lg:w-[60%]">
          <ExtractionReview
            markers={matchedMarkers}
            testDate={item.extractionResult.test_date}
            labName={item.extractionResult.lab_name}
            sampleType={item.extractionResult.sample_type}
            biomarkers={biomarkers}
            onMarkersChange={setMatchedMarkers}
            onSave={handleSave}
            isSaving={isSaving}
          />
        </div>
      </div>
    </div>
  )
}
