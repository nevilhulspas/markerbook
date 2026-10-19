'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp } from 'lucide-react'

import type { LabTestWithBiomarkers } from '@/actions/labs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import type { NextToTestList } from '@/lib/database.types'
import { AddToNextToTestPopover } from '@/components/next-to-test/add-to-next-to-test-popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type SortKey = 'name' | 'cost' | 'biomarkers'
type SortDir = 'asc' | 'desc'

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center font-medium"
    >
      {label}
      {active &&
        (dir === 'asc' ? (
          <ChevronUp className="ml-1 size-3" />
        ) : (
          <ChevronDown className="ml-1 size-3" />
        ))}
    </button>
  )
}

interface LabTestsTableProps {
  tests: LabTestWithBiomarkers[]
  nextToTestLists?: NextToTestList[]
  nextToTestMembership?: Record<string, string[]>
}

export function LabTestsTable({ tests, nextToTestLists, nextToTestMembership }: LabTestsTableProps) {
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const filtered = q
      ? tests.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            (t.method?.toLowerCase().includes(q) ?? false) ||
            t.biomarkers.some(
              (b) =>
                b.name.toLowerCase().includes(q) ||
                (b.short_name?.toLowerCase().includes(q) ?? false)
            )
        )
      : tests
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sortKey === 'cost') {
        const av = a.cost ?? Number.POSITIVE_INFINITY
        const bv = b.cost ?? Number.POSITIVE_INFINITY
        if (av !== bv) return (av - bv) * dir
        return a.name.localeCompare(b.name)
      }
      if (sortKey === 'biomarkers') {
        const diff = a.biomarkers.length - b.biomarkers.length
        if (diff !== 0) return diff * dir
        return a.name.localeCompare(b.name)
      }
      return a.name.localeCompare(b.name) * dir
    })
  }, [tests, filter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  if (tests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tests listed for this lab yet.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter tests…"
        aria-label="Filter tests"
        className="max-w-sm"
      />
      <div className="rounded-md border">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">
                <SortHeader
                  label="Test"
                  active={sortKey === 'name'}
                  dir={sortDir}
                  onClick={() => toggleSort('name')}
                />
              </TableHead>
              <TableHead className="w-[13%]">Method</TableHead>
              <TableHead className="w-[10%]">
                <SortHeader
                  label="Cost"
                  active={sortKey === 'cost'}
                  dir={sortDir}
                  onClick={() => toggleSort('cost')}
                />
              </TableHead>
              <TableHead className="w-[10%]">Sample</TableHead>
              <TableHead className="w-[11%] whitespace-nowrap">Turnaround</TableHead>
              <TableHead className="w-[26%]">
                <SortHeader
                  label="Biomarkers"
                  active={sortKey === 'biomarkers'}
                  dir={sortDir}
                  onClick={() => toggleSort('biomarkers')}
                />
              </TableHead>
              {nextToTestLists && (
                <TableHead className="w-1 px-3 py-2 text-left font-medium">Next</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={nextToTestLists ? 7 : 6}
                  className="text-center text-sm text-muted-foreground"
                >
                  No tests match your filter.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((test) => (
                <TableRow key={test.id}>
                  <TableCell className="font-medium break-words whitespace-normal">
                    {test.name}
                    {test.provider && (
                      <span
                        title={test.provider}
                        className="ml-1.5 inline-flex items-center rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400"
                      >
                        via {test.provider.split(/\s+/)[0]}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="break-words whitespace-normal text-muted-foreground">
                    {test.method ?? '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {test.cost != null
                      ? `${test.cost}${test.currency ? ' ' + test.currency : ''}`
                      : '—'}
                  </TableCell>
                  <TableCell className="break-words whitespace-normal">
                    {test.sample_type ?? '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {test.turnaround_days != null
                      ? `${test.turnaround_days} days`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {test.biomarkers.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {test.biomarkers.map((b) => (
                          <Badge key={b.id} variant="secondary" asChild>
                            <Link href={`/biomarkers/${b.id}`} title={b.name}>
                              {b.short_name ?? b.name}
                            </Link>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  {nextToTestLists && (
                    <TableCell className="px-3 py-2">
                      <AddToNextToTestPopover
                        target={{ kind: 'lab_test', labTestId: test.id }}
                        lists={nextToTestLists}
                        onLists={nextToTestMembership?.[test.id] ?? []}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {visible.length} of {tests.length} test{tests.length === 1 ? '' : 's'}
      </p>
    </div>
  )
}
