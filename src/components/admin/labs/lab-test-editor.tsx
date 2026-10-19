'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Loader2, Trash2 } from 'lucide-react'

import {
  adminSaveLabTest,
  adminDeleteLabTest,
  adminListLabTests,
  type AdminLabTestWithBiomarkers,
} from '@/actions/admin/labs'
import type { LabStatus } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type TestSortKey = 'name' | 'cost' | 'status'
type SortDir = 'asc' | 'desc'

interface BiomarkerOption {
  id: string
  name: string
  short_name: string | null
}

interface LabTestEditorProps {
  labId: string
  biomarkers: BiomarkerOption[]
}

const STATUS_OPTIONS: LabStatus[] = ['pending', 'approved', 'rejected']

const statusBadgeVariant: Record<LabStatus, 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
}

export function LabTestEditor({ labId, biomarkers }: LabTestEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [existingTests, setExistingTests] = useState<AdminLabTestWithBiomarkers[]>([])
  const [loadingTests, setLoadingTests] = useState(true)

  const loadTests = useCallback(async () => {
    const tests = await adminListLabTests(labId)
    setExistingTests(tests)
    setLoadingTests(false)
  }, [labId])

  useEffect(() => {
    let cancelled = false
    void adminListLabTests(labId).then((tests) => {
      if (cancelled) return
      setExistingTests(tests)
      setLoadingTests(false)
    })
    return () => {
      cancelled = true
    }
  }, [labId])

  // Existing-tests table: filter + sort
  const [testFilter, setTestFilter] = useState('')
  const [sortKey, setSortKey] = useState<TestSortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const visibleTests = useMemo(() => {
    const q = testFilter.trim().toLowerCase()
    const filtered = q
      ? existingTests.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            (t.method?.toLowerCase().includes(q) ?? false)
        )
      : existingTests
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sortKey === 'cost') {
        const av = a.cost ?? Number.POSITIVE_INFINITY
        const bv = b.cost ?? Number.POSITIVE_INFINITY
        return (av - bv) * dir
      }
      const av = sortKey === 'status' ? a.status : a.name
      const bv = sortKey === 'status' ? b.status : b.name
      return av.localeCompare(bv) * dir
    })
  }, [existingTests, testFilter, sortKey, sortDir])

  function toggleSort(key: TestSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const [showAddForm, setShowAddForm] = useState(false)
  const [name, setName] = useState('')
  const [method, setMethod] = useState('')
  const [cost, setCost] = useState('')
  const [currency, setCurrency] = useState('')
  const [sampleType, setSampleType] = useState('')
  const [turnaroundDays, setTurnaroundDays] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<LabStatus>('approved')
  const [selectedBiomarkerIds, setSelectedBiomarkerIds] = useState<string[]>([])
  const [biomarkerFilter, setBiomarkerFilter] = useState('')

  const filteredBiomarkers = useMemo(() => {
    const q = biomarkerFilter.trim().toLowerCase()
    if (!q) return biomarkers
    return biomarkers.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.short_name?.toLowerCase().includes(q) ?? false)
    )
  }, [biomarkers, biomarkerFilter])

  function toggleBiomarker(id: string) {
    setSelectedBiomarkerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function resetForm() {
    setName('')
    setMethod('')
    setCost('')
    setCurrency('')
    setSampleType('')
    setTurnaroundDays('')
    setNotes('')
    setStatus('approved')
    setSelectedBiomarkerIds([])
    setBiomarkerFilter('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Test name is required.')
      return
    }
    startTransition(async () => {
      const result = await adminSaveLabTest({
        lab_id: labId,
        name: name.trim(),
        method: method.trim() || null,
        cost: cost.trim() === '' ? null : Number(cost),
        currency: currency.trim() || null,
        turnaround_days: turnaroundDays.trim() === '' ? null : Number(turnaroundDays),
        sample_type: sampleType.trim() || null,
        notes: notes.trim() || null,
        status,
        biomarkerIds: selectedBiomarkerIds,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      resetForm()
      setShowAddForm(false)
      await loadTests()
      router.refresh()
    })
  }

  function handleDelete(testId: string, testName: string) {
    if (!window.confirm(`Delete test "${testName}"? This cannot be undone.`)) {
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await adminDeleteLabTest(testId)
      if (result.error) {
        setError(result.error)
        return
      }
      await loadTests()
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Existing tests */}
      <div className="space-y-2 rounded-md border p-4">
        <p className="text-sm font-medium">Existing tests</p>
        {loadingTests ? (
          <p className="text-muted-foreground text-sm">Loading tests...</p>
        ) : existingTests.length === 0 ? (
          <p className="text-muted-foreground text-sm">No tests yet.</p>
        ) : (
          <>
            <Input
              value={testFilter}
              onChange={(e) => setTestFilter(e.target.value)}
              placeholder="Filter tests…"
              aria-label="Filter tests"
            />
            <div className="max-h-[45vh] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="bg-background sticky top-0 z-10">
                  <TableRow>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort('name')}
                        className="flex items-center font-medium"
                      >
                        Name
                        {sortKey === 'name' &&
                          (sortDir === 'asc' ? (
                            <ChevronUp className="ml-1 size-3" />
                          ) : (
                            <ChevronDown className="ml-1 size-3" />
                          ))}
                      </button>
                    </TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort('cost')}
                        className="flex items-center font-medium"
                      >
                        Cost
                        {sortKey === 'cost' &&
                          (sortDir === 'asc' ? (
                            <ChevronUp className="ml-1 size-3" />
                          ) : (
                            <ChevronDown className="ml-1 size-3" />
                          ))}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort('status')}
                        className="flex items-center font-medium"
                      >
                        Status
                        {sortKey === 'status' &&
                          (sortDir === 'asc' ? (
                            <ChevronUp className="ml-1 size-3" />
                          ) : (
                            <ChevronDown className="ml-1 size-3" />
                          ))}
                      </button>
                    </TableHead>
                    <TableHead>Biomarkers</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleTests.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-muted-foreground text-center text-sm"
                      >
                        No tests match your filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleTests.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell
                          className="max-w-[260px] truncate font-medium"
                          title={t.name}
                        >
                          {t.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.method ?? '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {t.cost != null
                            ? `${t.cost}${t.currency ? ` ${t.currency}` : ''}`
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant[t.status]}>
                            {t.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {t.biomarkers.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {t.biomarkers.map((b) => (
                                <Badge key={b.id} variant="secondary" asChild>
                                  <Link
                                    href={`/biomarkers/${b.id}`}
                                    title={b.name}
                                  >
                                    {b.short_name ?? b.name}
                                  </Link>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(t.id, t.name)}
                            disabled={isPending}
                            aria-label={`Delete ${t.name}`}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-muted-foreground text-xs">
              {visibleTests.length} of {existingTests.length} test
              {existingTests.length === 1 ? '' : 's'}
            </p>
          </>
        )}
      </div>

      {error && !showAddForm && <p className="text-destructive text-sm">{error}</p>}

      {!showAddForm ? (
        <Button type="button" onClick={() => setShowAddForm(true)}>
          Add a test
        </Button>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-4 rounded-md border p-4">
      <p className="text-sm font-medium">Add a test</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`test-name-${labId}`}>Name</Label>
          <Input
            id={`test-name-${labId}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Vitamin D, 25-OH"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`test-method-${labId}`}>Method</Label>
          <Input
            id={`test-method-${labId}`}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            placeholder="e.g. LC-MS/MS"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`test-cost-${labId}`}>Cost</Label>
          <Input
            id={`test-cost-${labId}`}
            type="number"
            step="0.01"
            min="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="e.g. 49.95"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`test-currency-${labId}`}>Currency</Label>
          <Input
            id={`test-currency-${labId}`}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            placeholder="e.g. EUR"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`test-sample-${labId}`}>Sample type</Label>
          <Input
            id={`test-sample-${labId}`}
            value={sampleType}
            onChange={(e) => setSampleType(e.target.value)}
            placeholder="e.g. Serum"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`test-turnaround-${labId}`}>Turnaround (days)</Label>
          <Input
            id={`test-turnaround-${labId}`}
            type="number"
            min="0"
            value={turnaroundDays}
            onChange={(e) => setTurnaroundDays(e.target.value)}
            placeholder="e.g. 3"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`test-status-${labId}`}>Status</Label>
          <select
            id={`test-status-${labId}`}
            value={status}
            onChange={(e) => setStatus(e.target.value as LabStatus)}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`test-notes-${labId}`}>Notes</Label>
        <Textarea
          id={`test-notes-${labId}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`test-biomarker-filter-${labId}`}>
          Biomarkers covered ({selectedBiomarkerIds.length} selected)
        </Label>
        <Input
          id={`test-biomarker-filter-${labId}`}
          value={biomarkerFilter}
          onChange={(e) => setBiomarkerFilter(e.target.value)}
          placeholder="Filter biomarkers..."
        />
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
          {filteredBiomarkers.length === 0 ? (
            <p className="text-muted-foreground text-sm">No biomarkers match.</p>
          ) : (
            filteredBiomarkers.map((b) => (
              <label
                key={b.id}
                className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm"
              >
                <Checkbox
                  checked={selectedBiomarkerIds.includes(b.id)}
                  onCheckedChange={() => toggleBiomarker(b.id)}
                />
                <span>
                  {b.name}
                  {b.short_name ? (
                    <span className="text-muted-foreground"> ({b.short_name})</span>
                  ) : null}
                </span>
              </label>
            ))
          )}
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-1 size-4 animate-spin" />}
          Add test
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            resetForm()
            setError(null)
            setShowAddForm(false)
          }}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
      </form>
      )}
    </div>
  )
}
