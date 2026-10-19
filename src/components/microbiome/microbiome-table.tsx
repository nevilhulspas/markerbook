'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import type {
  MicrobiomeRank,
  MicrobiomeStatus,
} from '@/lib/database.types'
import type { MicrobiomeResultWithTaxon } from '@/actions/microbiome-tests'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MicrobiomeBar } from '@/components/microbiome/microbiome-bar'
import {
  formatMicrobiomeValue,
  formatRef,
  grade,
  type MicrobiomeGrade,
} from '@/lib/microbiome/format'
import { cn } from '@/lib/utils'

interface MicrobiomeTableProps {
  results: MicrobiomeResultWithTaxon[]
}

const RANK_ORDER: MicrobiomeRank[] = [
  'kingdom',
  'phylum',
  'class',
  'order',
  'family',
  'genus',
  'species',
  'strain',
  'functional_group',
]

const RANK_LABELS: Record<MicrobiomeRank, string> = {
  kingdom: 'Kingdom',
  phylum: 'Phylum',
  class: 'Class',
  order: 'Order',
  family: 'Family',
  genus: 'Genus',
  species: 'Species',
  strain: 'Strain',
  functional_group: 'Functional Group',
}

const STATUS_STYLES: Record<MicrobiomeStatus, string> = {
  low: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  normal:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  high: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
  unknown:
    'bg-muted text-muted-foreground',
}

const GRADE_STYLES: Record<MicrobiomeGrade, string> = {
  A: 'bg-emerald-600 text-white',
  B: 'bg-lime-500 text-white',
  C: 'bg-amber-500 text-white',
  D: 'bg-orange-500 text-white',
  E: 'bg-red-600 text-white',
}

function GradeBadge({ grade: g }: { grade: MicrobiomeGrade | null }) {
  if (!g) return <span className="text-muted-foreground">—</span>
  return (
    <span
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-md text-xs font-bold',
        GRADE_STYLES[g]
      )}
    >
      {g}
    </span>
  )
}

export function MicrobiomeTable({ results }: MicrobiomeTableProps) {
  // Filter by rank chip + optional name search.
  const [activeRank, setActiveRank] = useState<MicrobiomeRank | 'all'>('all')
  const [query, setQuery] = useState('')
  const [openRanks, setOpenRanks] = useState<Record<MicrobiomeRank, boolean>>(
    () => {
      const init = {} as Record<MicrobiomeRank, boolean>
      for (const r of RANK_ORDER) init[r] = true
      return init
    }
  )

  const grouped = useMemo(() => {
    const filtered = results.filter((r) => {
      if (activeRank !== 'all' && r.microbiome_taxa.rank !== activeRank) {
        return false
      }
      if (
        query &&
        !r.microbiome_taxa.name.toLowerCase().includes(query.toLowerCase()) &&
        !(r.raw_label ?? '').toLowerCase().includes(query.toLowerCase())
      ) {
        return false
      }
      return true
    })

    const byRank = new Map<MicrobiomeRank, MicrobiomeResultWithTaxon[]>()
    for (const r of filtered) {
      const list = byRank.get(r.microbiome_taxa.rank) ?? []
      list.push(r)
      byRank.set(r.microbiome_taxa.rank, list)
    }

    return RANK_ORDER.filter((r) => byRank.has(r)).map((rank) => ({
      rank,
      items: byRank
        .get(rank)!
        .sort((a, b) => {
          // Abnormal first, then alphabetical.
          const order = { high: 0, low: 1, normal: 2, unknown: 3 } as const
          const sa = order[(a.status ?? 'unknown') as MicrobiomeStatus]
          const sb = order[(b.status ?? 'unknown') as MicrobiomeStatus]
          if (sa !== sb) return sa - sb
          return a.microbiome_taxa.name.localeCompare(b.microbiome_taxa.name)
        }),
    }))
  }, [results, activeRank, query])

  if (results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>All Taxa</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No taxa imported for this test yet.
        </CardContent>
      </Card>
    )
  }

  const ranksPresent = Array.from(
    new Set(results.map((r) => r.microbiome_taxa.rank))
  ).sort((a, b) => RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b))

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Taxa</CardTitle>
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveRank('all')}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs transition-colors',
                activeRank === 'all'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-foreground/40'
              )}
            >
              All
            </button>
            {ranksPresent.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setActiveRank(r)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs transition-colors',
                  activeRank === r
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:border-foreground/40'
                )}
              >
                {RANK_LABELS[r]}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search taxa..."
            className="h-8 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-56"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {grouped.map((group) => {
          const isOpen = openRanks[group.rank]
          return (
            <div key={group.rank} className="space-y-2">
              <button
                type="button"
                onClick={() =>
                  setOpenRanks((prev) => ({ ...prev, [group.rank]: !isOpen }))
                }
                className="flex w-full items-center gap-2 text-left text-sm font-semibold text-muted-foreground"
              >
                {isOpen ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
                {RANK_LABELS[group.rank]}
                <span className="text-xs font-normal">
                  ({group.items.length})
                </span>
              </button>

              {isOpen && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Name</th>
                        <th className="py-2 pr-4 font-medium">Value</th>
                        <th
                          className="py-2 pr-4 font-medium"
                          title="Severity grade — A is ideal, E is far off. Directionally consistent: higher grade is always healthier, whether the norm is a floor or a ceiling."
                        >
                          Grade
                        </th>
                        <th className="hidden py-2 pr-4 font-medium sm:table-cell">
                          Level
                        </th>
                        <th className="py-2 pr-4 font-medium">Reference</th>
                        <th className="py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b last:border-b-0 hover:bg-muted/30"
                        >
                          <td className="py-2 pr-4">
                            <div className="font-medium">
                              {r.microbiome_taxa.name}
                            </div>
                            {r.raw_label &&
                              r.raw_label !== r.microbiome_taxa.name && (
                                <div className="text-xs text-muted-foreground">
                                  {r.raw_label}
                                </div>
                              )}
                          </td>
                          <td className="py-2 pr-4 font-mono text-xs tabular-nums whitespace-nowrap">
                            {formatMicrobiomeValue(r.value, r.unit, r.raw_label)}
                          </td>
                          <td className="py-2 pr-4">
                            <GradeBadge
                              grade={grade(
                                r.value,
                                r.ref_low,
                                r.ref_high,
                                r.unit
                              )}
                            />
                          </td>
                          <td className="hidden py-2 pr-4 sm:table-cell">
                            <MicrobiomeBar
                              value={r.value}
                              refLow={r.ref_low}
                              refHigh={r.ref_high}
                              unit={r.unit}
                              status={r.status}
                            />
                          </td>
                          <td className="py-2 pr-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {formatRef(r.ref_low, r.ref_high, r.unit) ?? '—'}
                          </td>
                          <td className="py-2">
                            <Badge
                              variant="secondary"
                              className={cn(
                                'capitalize',
                                STATUS_STYLES[
                                  (r.status ?? 'unknown') as MicrobiomeStatus
                                ]
                              )}
                            >
                              {r.status ?? 'unknown'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}

        {grouped.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No taxa match the current filter.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
