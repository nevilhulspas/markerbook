'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

import type { Biomarker } from '@/lib/database.types'
import type { MarkerEntryValues } from '@/lib/validations/blood-test'
import { Button } from '@/components/ui/button'
import { MarkerEntry } from '@/components/tests/marker-entry'

interface MarkerEntryListProps {
  biomarkers: Biomarker[]
  value: MarkerEntryValues[]
  onChange: (entries: MarkerEntryValues[]) => void
  onBiomarkerCreated?: (biomarker: Biomarker) => void
}

export function MarkerEntryList({
  biomarkers,
  value,
  onChange,
  onBiomarkerCreated,
}: MarkerEntryListProps) {
  const usedIds = value.map((e) => e.biomarker_id)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  // Read hash on mount and scroll to + highlight the target marker
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.startsWith('#marker-')) return

    const biomarkerId = hash.replace('#marker-', '')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL hash is only readable after mount
    setHighlightedId(biomarkerId)

    // Wait for DOM to render, then scroll
    requestAnimationFrame(() => {
      const el = document.getElementById(hash.slice(1))
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })

    // Clear highlight after a few seconds
    const timer = setTimeout(() => setHighlightedId(null), 10000)
    return () => clearTimeout(timer)
  }, [])

  function handleAdd() {
    onChange([
      ...value,
      { biomarker_id: '', value: 0, unit: '' },
    ])
  }

  function handleChange(index: number, entry: MarkerEntryValues) {
    const updated = [...value]
    updated[index] = entry
    onChange(updated)
  }

  function handleRemove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {value.length === 0
            ? 'No markers added yet'
            : `${value.length} marker${value.length === 1 ? '' : 's'} added`}
        </p>
      </div>

      {value.map((entry, index) => (
        <MarkerEntry
          key={index}
          biomarkers={biomarkers}
          value={entry.biomarker_id ? entry : null}
          onChange={(updated) => handleChange(index, updated)}
          onRemove={() => handleRemove(index)}
          excludeIds={usedIds.filter((id): id is string => !!id && id !== entry.biomarker_id)}
          highlighted={entry.biomarker_id === highlightedId}
          onBiomarkerCreated={onBiomarkerCreated}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        className="w-full"
      >
        <Plus className="size-4" />
        Add Marker
      </Button>
    </div>
  )
}
