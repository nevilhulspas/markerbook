'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import type { DutchMarker } from '@/lib/database.types'
import type {
  DutchExtractionResult,
  DutchMatchedMarker,
} from '@/lib/dutch/types'
import { extractDutchPdf } from '@/actions/dutch-import'
import { createDutchTest } from '@/actions/dutch-tests'
import { Button } from '@/components/ui/button'
import { PdfDropzone } from '@/components/import/pdf-dropzone'
import {
  DutchExtractionReview,
  type DutchImportMetadata,
} from '@/components/dutch/dutch-extraction-review'

const PdfViewer = dynamic(
  () => import('@/components/import/pdf-viewer').then((m) => m.PdfViewer),
  { ssr: false }
)

type Step = 'upload' | 'processing' | 'review' | 'saving' | 'error'

interface DutchImportClientProps {
  dutchBiomarkers: DutchMarker[]
}

export function DutchImportClient({
  dutchBiomarkers,
}: DutchImportClientProps) {
  const router = useRouter()

  const [file, setFile] = useState<File | null>(null)
  const [step, setStep] = useState<Step>('upload')
  const [statusText, setStatusText] = useState('')
  const [extractionResult, setExtractionResult] =
    useState<DutchExtractionResult | null>(null)
  const [matchedMarkers, setMatchedMarkers] = useState<
    DutchMatchedMarker[] | null
  >(null)
  const [storagePath, setStoragePath] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleFileAccepted(accepted: File) {
    setFile(accepted)
    setStep('processing')
    setStatusText('Uploading and analyzing DUTCH PDF...')
    setErrorMessage(null)

    try {
      const formData = new FormData()
      formData.append('pdf', accepted)

      const result = await extractDutchPdf(formData)

      if (result.success) {
        setExtractionResult(result.data)
        setMatchedMarkers(result.matched_markers)
        setStoragePath(result.storage_path)
        setStep('review')
      } else {
        setErrorMessage(result.error)
        if (result.storage_path) setStoragePath(result.storage_path)
        setStep('error')
      }
    } catch {
      setErrorMessage('An unexpected error occurred during extraction.')
      setStep('error')
    }
  }

  async function handleSave(metadata: DutchImportMetadata) {
    if (!matchedMarkers) return

    // Filter to selected + matched markers, map to save format
    const selectedMatched = matchedMarkers.filter(
      (m) => m.selected && m.matched && m.biomarker_id
    )

    if (selectedMatched.length === 0) {
      toast.error('No matched markers selected. Map at least one marker before saving.')
      return
    }

    // Deduplicate: same biomarker_id + same timepoint = duplicate
    const seen = new Set<string>()
    const deduplicated = selectedMatched.filter((m) => {
      const key = `${m.biomarker_id}:${m.timepoint ?? 'null'}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    if (deduplicated.length < selectedMatched.length) {
      toast.error(
        'Duplicate biomarker/timepoint combinations found. Remove duplicates before saving.'
      )
      return
    }

    setStep('saving')

    const markers = deduplicated.map((m) => ({
      biomarker_id: m.biomarker_id!,
      value: m.value,
      unit: m.unit,
      timepoint: m.timepoint,
    }))

    const result = await createDutchTest({
      name: metadata.testName || 'DUTCH Test',
      test_date: metadata.date,
      menstrual_phase: metadata.menstrualPhase,
      cycle_day: metadata.cycleDay,
      pdf_storage_path: storagePath ?? undefined,
      markers,
    })

    if (result.success) {
      toast.success('DUTCH test imported successfully')
      router.push('/dutch')
    } else {
      toast.error(result.error ?? 'Failed to save DUTCH test')
      setStep('review')
    }
  }

  function handleReset() {
    setFile(null)
    setStep('upload')
    setStatusText('')
    setExtractionResult(null)
    setMatchedMarkers(null)
    setStoragePath(null)
    setErrorMessage(null)
  }

  // Upload / Processing step
  if (step === 'upload' || step === 'processing') {
    return (
      <PdfDropzone
        onFilesAccepted={(acceptedFiles) => {
          const firstFile = acceptedFiles[0]
          if (firstFile) {
            void handleFileAccepted(firstFile)
          }
        }}
        isProcessing={step === 'processing'}
        statusText={statusText}
      />
    )
  }

  // Error step
  if (step === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <AlertTriangle className="size-12 text-destructive" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">Extraction Failed</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {errorMessage ?? 'An unknown error occurred.'}
          </p>
        </div>
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="size-4" />
          Try Again
        </Button>
      </div>
    )
  }

  // Review / Saving step
  if (
    (step === 'review' || step === 'saving') &&
    extractionResult &&
    matchedMarkers
  ) {
    return (
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* PDF viewer */}
        <div className="w-full lg:sticky lg:top-4 lg:w-1/2 lg:self-start">
          {file && <PdfViewer file={file} />}
        </div>

        {/* Review table */}
        <div className="w-full lg:w-1/2">
          <DutchExtractionReview
            markers={matchedMarkers}
            testDate={extractionResult.test_date}
            patientSex={extractionResult.patient_sex}
            dutchBiomarkers={dutchBiomarkers}
            onMarkersChange={setMatchedMarkers}
            onSave={handleSave}
            isSaving={step === 'saving'}
          />
        </div>
      </div>
    )
  }

  return null
}
