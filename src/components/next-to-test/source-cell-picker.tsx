'use client'

// AUT-854 follow-up: inline lab picker on the Source cell.
//
// Two behaviors keyed on the row's kind:
// - biomarker row ("Any lab"): click → popover lists labs that offer this
//   biomarker. Picking one converts the row to a lab_test entry.
// - lab_test row (specific lab): click → popover shows ALL labs offering the
//   same biomarker (derived from the lab_test's first biomarker mapping),
//   PLUS an "Any lab" option to unpin. Picking switches the lab.
//
// The list of options is computed page-side (one batched query for all rows)
// and passed in via props — the popover is purely presentational + write.

import {
  useState,
  useTransition,
  useMemo,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Check, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'

import {
  pinEntryToLab,
  unpinEntryToBiomarker,
} from '@/actions/next-to-test/entries'
import type { LabOptionForBiomarker } from '@/lib/next-to-test/lab-options'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface Props {
  entryId: string
  kind: 'biomarker' | 'lab_test'
  // The current lab's labTestId for lab_test rows; null for biomarker rows.
  currentLabTestId: string | null
  // The biomarker_id to convert back to when "Any lab" is picked. For
  // biomarker rows this IS the entry's biomarker_id. For lab_test rows it's
  // the first biomarker mapping of the lab_test (or null when the lab_test
  // maps to nothing / many — disables the unpin option).
  biomarkerId: string | null
  options: LabOptionForBiomarker[]
}

// Threshold above which a quick-search input renders inside the popover.
// Tiny lists (a couple of options) don't need search — the input would just
// take vertical space the user has to look past.
const SEARCH_MIN_OPTIONS = 6

export function SourceCellPicker({
  entryId,
  kind,
  currentLabTestId,
  biomarkerId,
  options,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')

  const currentLabel = kind === 'biomarker' ? 'Any lab' : labelFor(options, currentLabTestId)
  const canUnpin = kind === 'lab_test' && !!biomarkerId

  // Filter the option list by the search input. Match against BOTH the lab
  // name and the lab_test name so the user can type "lina" to narrow by lab
  // OR "vitamin b1" to narrow by test. Case-insensitive substring; whitespace
  // around the query is ignored.
  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) =>
        o.labName.toLowerCase().includes(q) ||
        o.labTestName.toLowerCase().includes(q)
    )
  }, [options, search])

  const showSearch = options.length >= SEARCH_MIN_OPTIONS

  function handlePick(target: 'any' | LabOptionForBiomarker) {
    startTransition(async () => {
      const res =
        target === 'any'
          ? await unpinEntryToBiomarker(entryId, biomarkerId!)
          : await pinEntryToLab(entryId, target.labTestId)
      if ('ok' in res) {
        toast.success(
          target === 'any'
            ? 'Switched to Any lab'
            : `Pinned to ${target.labName}`
        )
        setOpen(false)
        setSearch('')
        router.refresh()
      } else if (res.error === 'duplicate') {
        toast.error('That lab is already on this list for this test.')
      } else if (res.error === 'unauthorized') {
        toast.error('Sign in to change this.')
      } else {
        toast.error(`Couldn't switch — ${res.error}`)
      }
    })
  }

  // Nothing to pick: no labs in catalogue offer this biomarker AND we can't
  // unpin a biomarker row to itself. Show the label as plain static text so
  // the user isn't teased with an unresponsive button.
  if (options.length === 0 && !canUnpin) {
    return (
      <span className="text-muted-foreground">{currentLabel}</span>
    )
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // Reset the search when the popover closes so reopening starts fresh.
        if (!next) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto -mx-2 px-2 py-0.5 font-normal text-muted-foreground hover:text-foreground"
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <>
              <span>{currentLabel}</span>
              <ChevronDown className="size-3 opacity-60" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        // Wider than the default w-80 from before — long bundle names like
        // "Genetic panel Vitamins (vitamin B1, B6, B9)" used to truncate.
        // Hard cap at 28rem so the popover doesn't sprawl on wide viewports.
        className="w-[28rem] max-w-[90vw] p-1"
      >
        {showSearch && (
          <div className="relative px-1 pt-1 pb-1.5">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-3.5 -translate-y-1/2" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search labs or tests…"
              className="h-8 pl-8 text-sm"
            />
          </div>
        )}
        {!showSearch && (
          <div className="px-2 py-1 text-xs text-muted-foreground">
            Pick a lab for this test
          </div>
        )}
        <div className="space-y-0.5">
          {/* Any lab option — present whenever the row's biomarker is known.
              Hidden when the search query is set AND doesn't match "any" so
              the search treats the synthetic option consistently with the
              real ones. */}
          {(canUnpin || kind === 'biomarker') &&
          'any lab'.includes(search.trim().toLowerCase()) ? (
            <button
              type="button"
              onClick={() => handlePick('any')}
              disabled={isPending || kind === 'biomarker'}
              className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm disabled:opacity-50"
            >
              <span className="flex size-4 items-center justify-center">
                {kind === 'biomarker' && <Check className="size-3.5" />}
              </span>
              <span className="flex-1">Any lab</span>
              <span className="text-xs text-muted-foreground">
                {kind === 'biomarker' ? 'current' : 'lab-agnostic'}
              </span>
            </button>
          ) : null}
          {/* Group by lab; within each lab, dedicated single-marker tests
              render first, then a thin divider, then bundles/panels with a
              "panel · N markers" annotation so the user knows what they're
              ordering. options[] is pre-sorted by lab then by single→bundle. */}
          {filteredOptions.length > 0 ? (
            renderGroupedOptions({
              options: filteredOptions,
              currentLabTestId,
              isPending,
              onPick: handlePick,
            })
          ) : (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              No labs or tests match &quot;{search.trim()}&quot;.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function labelFor(
  options: LabOptionForBiomarker[],
  labTestId: string | null
): string {
  if (!labTestId) return '—'
  const opt = options.find((o) => o.labTestId === labTestId)
  // When the row's lab_test isn't in the options list (e.g. its biomarker
  // mapping was deleted), fall back to a placeholder so we don't render an
  // empty cell.
  return opt?.labName ?? 'Other lab'
}

function formatCost(cost: number | null): string {
  if (cost == null) return '—'
  // BGN is the project's display currency for Lina + BODIMED; the catalogue
  // doesn't carry per-row currency yet so we render the bare number.
  return cost % 1 === 0 ? `€${cost.toFixed(0)}` : `€${cost.toFixed(2)}`
}

/**
 * Render the options grouped by lab. Within each lab the list is already
 * sorted single→bundle, so we walk it linearly and:
 *   - emit a small uppercase lab-name header when the lab changes;
 *   - emit a thin divider when crossing from dedicated tests (markerCount=1)
 *     to bundles (markerCount>1) inside the same lab;
 *   - tag bundle rows with "panel · N markers" so the user can tell them
 *     apart from dedicated single-marker tests at a glance.
 */
function renderGroupedOptions({
  options,
  currentLabTestId,
  isPending,
  onPick,
}: {
  options: LabOptionForBiomarker[]
  currentLabTestId: string | null
  isPending: boolean
  onPick: (o: LabOptionForBiomarker) => void
}) {
  const nodes: ReactNode[] = []
  let lastLabId: string | null = null
  let lastWasSingle: boolean | null = null

  for (const o of options) {
    const isBundle = o.markerCount > 1
    const labChanged = o.labId !== lastLabId
    const singleToBundleTransition =
      !labChanged && lastWasSingle === true && isBundle

    if (labChanged) {
      // Spacer above each lab section (except the very first).
      if (lastLabId !== null) {
        nodes.push(<div key={`spacer-${o.labId}`} className="h-1" />)
      }
      nodes.push(
        <div
          key={`label-${o.labId}`}
          className="text-muted-foreground/70 px-2 pt-0.5 text-[10px] font-medium uppercase tracking-wide"
        >
          {o.labName}
        </div>
      )
      lastWasSingle = null
    }

    if (singleToBundleTransition) {
      nodes.push(
        <div
          key={`divider-${o.labTestId}`}
          className="mx-2 my-0.5 border-t border-dashed"
          aria-hidden
        />
      )
    }

    const active = o.labTestId === currentLabTestId
    nodes.push(
      <button
        key={o.labTestId}
        type="button"
        onClick={() => onPick(o)}
        disabled={isPending || active}
        className="hover:bg-accent flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm disabled:opacity-50"
      >
        <span className="mt-0.5 flex size-4 items-center justify-center">
          {active && <Check className="size-3.5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate">{o.labTestName}</span>
          {isBundle && (
            <span className="text-muted-foreground text-[11px]">
              panel · {o.markerCount} markers
            </span>
          )}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {formatCost(o.cost)}
        </span>
      </button>
    )

    lastLabId = o.labId
    lastWasSingle = !isBundle
  }
  return nodes
}
