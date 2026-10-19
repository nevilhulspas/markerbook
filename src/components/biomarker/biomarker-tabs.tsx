'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Star } from 'lucide-react'

import { Input } from '@/components/ui/input'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { SuggestionForm } from '@/components/biomarker/suggestion-form'
import { setUnitPreference } from '@/actions/unit-preferences'
import type { NextToTestList } from '@/lib/database.types'
import { APP_LOCALE } from '@/lib/locale'
import { AddToNextToTestPopover } from '@/components/next-to-test/add-to-next-to-test-popover'

export interface CatalogItem {
  id: string
  name: string
  shortName: string | null
  family: string | null
  category: string
  unit: string
  method: string | null
  panelName: string | null
  systemName: string | null
  hasUserData: boolean
  isFavorite: boolean
  availableUnits: Array<{ unit: string; conversionFactor: number }>
  latestValue: number | null
  latestUnit: string | null
  latestDate: string | null
  latestTestName: string | null
}

interface BiomarkerTabsProps {
  items: CatalogItem[]
  userMarkerCount: number
  userSex: 'male' | 'female' | null
  unitPreferences?: [string, string][]
  nextToTestLists?: NextToTestList[]
  nextToTestMembership?: Record<string, string[]>
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(APP_LOCALE, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Category grouping: case-insensitive key (merges "Hematology"/"hematology"),
// title-cased label, with empty/"other" sorted last.
function catKey(category: string): string {
  return category.trim().toLowerCase() || 'other'
}
function catLabel(key: string): string {
  return key === 'other' ? 'Other' : key.replace(/\b\w/g, (c) => c.toUpperCase())
}

function MarkerTable({
  items,
  showSystem = true,
  unitPrefsMap,
  onUnitChange,
  nextToTestLists,
  nextToTestMembership,
}: {
  items: CatalogItem[]
  showSystem?: boolean
  unitPrefsMap: Map<string, string>
  onUnitChange: (biomarkerId: string, unit: string) => void
  nextToTestLists?: NextToTestList[]
  nextToTestMembership?: Record<string, string[]>
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Abbreviation</th>
            <th className="px-3 py-2 font-medium">Clean name</th>
            <th className="px-3 py-2 font-medium">Unit</th>
            <th className="px-3 py-2 font-medium">Method</th>
            {showSystem && <th className="px-3 py-2 font-medium">System</th>}
            <th className="px-3 py-2 text-right font-medium">Latest</th>
            <th className="px-3 py-2 text-right font-medium">Date</th>
            {nextToTestLists && nextToTestLists.length > 0 && <th className="w-1 px-3 py-2 font-medium">Next</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {(() => {
            const colCount = 6 + (showSystem ? 1 : 0) + (nextToTestLists?.length ? 1 : 0)
            const sorted = [...items].sort((a, b) => {
              const ca = catKey(a.category), cb = catKey(b.category)
              if (ca !== cb) {
                if (ca === 'other') return 1
                if (cb === 'other') return -1
                return ca.localeCompare(cb)
              }
              const ka = (a.family ?? a.name).toLowerCase()
              const kb = (b.family ?? b.name).toLowerCase()
              return ka === kb ? a.name.localeCompare(b.name) : ka.localeCompare(kb)
            })
            return sorted.map((item, idx) => {
            const prev = sorted[idx - 1]
            const next = sorted[idx + 1]
            const ck = catKey(item.category)
            const showCategory = !prev || catKey(prev.category) !== ck
            const inFamily = item.family != null
            const isFirstInFamily = inFamily && !(prev && catKey(prev.category) === ck && prev.family === item.family)
            const isLastInFamily = inFamily && !(next && catKey(next.category) === ck && next.family === item.family)
            const displayUnit = unitPrefsMap.get(item.id) ?? item.latestUnit ?? item.unit
            const labUnit = item.latestUnit ?? item.unit
            let displayValue = item.latestValue
            if (displayValue != null && labUnit.toLowerCase() !== displayUnit.toLowerCase() && item.availableUnits.length > 1) {
              const fromFactor = item.availableUnits.find((u) => u.unit.toLowerCase() === labUnit.toLowerCase())?.conversionFactor
              const toFactor = item.availableUnits.find((u) => u.unit.toLowerCase() === displayUnit.toLowerCase())?.conversionFactor
              if (fromFactor != null && toFactor != null && toFactor !== 0) {
                displayValue = Math.round((displayValue * fromFactor / toFactor) * 10) / 10
              }
            }
            return (
            <Fragment key={item.id}>
            {showCategory && (
              <tr>
                <td colSpan={colCount} className="bg-muted/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {catLabel(ck)}
                </td>
              </tr>
            )}
            <tr className="transition-colors hover:bg-accent">
              <td className="relative px-3 py-2">
                {/* Connected tree: continuous vertical line (full height for branches, down to
                    the elbow for the last child) + a horizontal elbow into the abbreviation row. */}
                {inFamily && (
                  <>
                    {/* vertical line spans only between the children's elbows (not up to the row top) */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-3 w-px bg-border"
                      style={isFirstInFamily ? { bottom: 0, height: 18 } : isLastInFamily ? { top: 0, bottom: 18 } : { top: 0, bottom: 0 }}
                    />
                    <span aria-hidden className="pointer-events-none absolute left-3 h-px w-3 bg-border" style={{ bottom: 18 }} />
                  </>
                )}
                {/* Parent/family name as a small label on the first child only (grid style) — at the left */}
                {isFirstInFamily && item.family && (
                  <div className="text-[10px] font-medium leading-none text-muted-foreground/60">
                    {item.family}
                  </div>
                )}
                <div className={`font-medium ${inFamily ? 'pl-8' : ''} ${isFirstInFamily ? 'mt-1' : ''}`}>
                  <Link href={`/biomarkers/${item.id}`} className="hover:underline">
                    {item.shortName ?? '—'}
                  </Link>
                </div>
              </td>
              <td className="px-3 py-2">
                <Link href={`/biomarkers/${item.id}`} className="hover:underline">
                  {item.name}
                </Link>
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {item.availableUnits.length > 1 ? (
                  <select
                    value={displayUnit}
                    onChange={(e) => onUnitChange(item.id, e.target.value)}
                    className="w-full cursor-pointer rounded border-none bg-transparent px-0 py-0 text-sm text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                  >
                    {item.availableUnits.map((u) => (
                      <option key={u.unit} value={u.unit}>{u.unit}</option>
                    ))}
                  </select>
                ) : (
                  item.unit
                )}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{item.method ?? '—'}</td>
              {showSystem && (
                <td className="px-3 py-2 text-muted-foreground">{item.systemName ?? '—'}</td>
              )}
              <td className="px-3 py-2 text-right tabular-nums">
                {displayValue != null ? (
                  <span>
                    {displayValue} {displayUnit}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-right text-muted-foreground">
                {item.latestDate ? formatDate(item.latestDate) : '—'}
              </td>
              {nextToTestLists && nextToTestLists.length > 0 && (
                <td className="px-3 py-2">
                  <AddToNextToTestPopover
                    target={{ kind: 'biomarker', biomarkerId: item.id }}
                    lists={nextToTestLists}
                    onLists={nextToTestMembership?.[item.id] ?? []}
                  />
                </td>
              )}
            </tr>
            </Fragment>
          )})
          })()}
        </tbody>
      </table>
    </div>
  )
}

export function BiomarkerTabs({
  items,
  unitPreferences,
  nextToTestLists,
  nextToTestMembership,
}: BiomarkerTabsProps) {
  const [search, setSearch] = useState('')
  const [unitPrefsMap, setUnitPrefsMap] = useState(
    () => new Map(unitPreferences ?? [])
  )

  function handleUnitChange(biomarkerId: string, unit: string) {
    setUnitPrefsMap((prev) => {
      const next = new Map(prev)
      next.set(biomarkerId, unit)
      return next
    })
    setUnitPreference(biomarkerId, unit)
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.shortName?.toLowerCase().includes(q) ?? false) ||
        item.category.toLowerCase().includes(q) ||
        (item.panelName?.toLowerCase().includes(q) ?? false) ||
        (item.systemName?.toLowerCase().includes(q) ?? false)
    )
  }, [items, search])

  const userItems = useMemo(
    () => filtered.filter((i) => i.hasUserData),
    [filtered]
  )

  const favoriteItems = useMemo(
    () => filtered.filter((i) => i.isFavorite),
    [filtered]
  )

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search biomarkers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="your-markers">
        <TabsList>
          <TabsTrigger value="your-markers">
            Your Markers ({userItems.length})
          </TabsTrigger>
          <TabsTrigger value="favorites">
            <Star className="size-3 fill-yellow-400 text-yellow-400" />
            Favorites ({favoriteItems.length})
          </TabsTrigger>
          <TabsTrigger value="catalog">
            Catalog ({filtered.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="your-markers" className="mt-4">
          {userItems.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground">
                {search
                  ? 'No markers match your search.'
                  : 'No biomarker data yet. Import a blood test to see your markers here.'}
              </p>
            </div>
          ) : (
            <MarkerTable items={userItems} unitPrefsMap={unitPrefsMap} onUnitChange={handleUnitChange} nextToTestLists={nextToTestLists} nextToTestMembership={nextToTestMembership} />
          )}
        </TabsContent>

        <TabsContent value="favorites" className="mt-4">
          {favoriteItems.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground">
                {search
                  ? 'No favorites match your search.'
                  : 'No favorites yet. Star biomarkers from their detail page to add them here.'}
              </p>
            </div>
          ) : (
            <MarkerTable items={favoriteItems} unitPrefsMap={unitPrefsMap} onUnitChange={handleUnitChange} nextToTestLists={nextToTestLists} nextToTestMembership={nextToTestMembership} />
          )}
        </TabsContent>

        <TabsContent value="catalog" className="mt-4 space-y-6">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground">
                No biomarkers match your search.
              </p>
            </div>
          ) : (
            <MarkerTable items={filtered} unitPrefsMap={unitPrefsMap} onUnitChange={handleUnitChange} nextToTestLists={nextToTestLists} nextToTestMembership={nextToTestMembership} />
          )}

          <SuggestionForm />
        </TabsContent>
      </Tabs>
    </div>
  )
}
