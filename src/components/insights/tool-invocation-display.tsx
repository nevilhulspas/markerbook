'use client'

import { Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

const TOOL_LABELS: Record<string, string> = {
  lookupMarkerHistory: 'Looking up marker history',
  compareMarkers: 'Comparing markers',
  checkSupplementInteractions: 'Checking supplement interactions',
  lab_test_finder: 'Looking up lab tests',
  build_lab_test_lists: 'Building lab test lists',
  list_lab_tests: 'Listing lab catalogue',
  web_search: 'Searching the web',
  // Next-to-test tools — friendly chat-side labels so the
  // user doesn't see raw tool names.
  add_to_next_to_test: 'Adding to next-to-test',
  add_many_to_next_to_test: 'Adding tests to next-to-test',
  mark_next_to_test_done: 'Marking next-to-test entry done',
  remove_from_next_to_test: 'Removing from next-to-test',
  list_next_to_test: 'Reading next-to-test list',
  // Stack + wishlist tools — without these the chat shows the raw tool name.
  list_stack: 'Reading your stack',
  add_supplement: 'Adding a supplement',
  update_supplement: 'Updating a supplement',
  remove_supplement: 'Removing a supplement',
  list_wishlist: 'Reading your wishlist',
  add_wishlist_item: 'Adding a wishlist item',
  update_wishlist_item: 'Updating a wishlist item',
  remove_wishlist_item: 'Removing a wishlist item',
  add_wishlist_source: 'Adding a buy-source',
  move_wishlist_to_stack: 'Moving to your stack',
}

interface ToolInvocationProps {
  toolName: string
  state: string
  input?: unknown
  output?: unknown
}

/**
 * Build a "running" label that surfaces the salient argument(s) for the call
 * (e.g. "Adding HDL Cholesterol to Up next…") instead of the bare tool label.
 * Falls back to the static label if no useful args are available — important
 * during `input-streaming` where input may be partial JSON.
 */
function runningLabel(toolName: string, input: unknown): string {
  const base = TOOL_LABELS[toolName] ?? toolName
  if (!input || typeof input !== 'object') return base
  const a = input as Record<string, unknown>

  if (toolName === 'add_to_next_to_test') {
    const bio = typeof a.biomarkerName === 'string' ? a.biomarkerName : null
    const test = typeof a.testName === 'string' ? a.testName : null
    const lab = typeof a.labName === 'string' ? a.labName : null
    const list = typeof a.listName === 'string' ? a.listName : null
    const target = bio ?? (test && lab ? `${test} (${lab})` : test)
    if (target) return `Adding ${target}${list ? ` to ${list}` : ''}…`
  }
  if (toolName === 'add_many_to_next_to_test') {
    const items = Array.isArray(a.items) ? a.items : null
    const list = typeof a.listName === 'string' ? a.listName : null
    if (items)
      return `Adding ${items.length} test${items.length === 1 ? '' : 's'}${list ? ` to ${list}` : ''}…`
  }
  if (toolName === 'mark_next_to_test_done') return 'Marking entry done…'
  if (toolName === 'remove_from_next_to_test') return 'Removing entry…'
  if (toolName === 'list_next_to_test') {
    const list = typeof a.listName === 'string' ? a.listName : null
    return list ? `Reading "${list}"…` : 'Reading next-to-test list…'
  }
  if (toolName === 'lookupMarkerHistory') {
    const m = typeof a.markerName === 'string' ? a.markerName : null
    if (m) return `Looking up ${m} history…`
  }
  if (toolName === 'lab_test_finder') {
    const b = typeof a.biomarker === 'string' ? a.biomarker : null
    if (b) return `Looking up labs offering ${b}…`
  }
  if (toolName === 'web_search') {
    const q = typeof a.query === 'string' ? a.query : null
    if (q) return `Searching the web for "${q.slice(0, 60)}"…`
  }

  return `${base}…`
}

export function ToolInvocationDisplay({
  toolName,
  state,
  input,
  output,
}: ToolInvocationProps) {
  const label = TOOL_LABELS[toolName] ?? toolName

  if (state === 'input-streaming' || state === 'input-available') {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        {runningLabel(toolName, input)}
      </div>
    )
  }

  if (state === 'output-available' && output) {
    return (
      <div className="rounded-lg border bg-muted/30 px-3 py-2">
        <div className="mb-1 flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {label}
          </Badge>
        </div>
        <ToolResultContent toolName={toolName} input={input} result={output} />
      </div>
    )
  }

  if (state === 'output-error') {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        Tool error: {label}
      </div>
    )
  }

  return null
}

function ToolResultContent({
  toolName,
  input,
  result,
}: {
  toolName: string
  input?: unknown
  result: unknown
}) {
  const data = result as Record<string, unknown>

  // Friendly per-tool renderers for the next-to-test
  // family. These all share a tiny shape: { added | ok | error, entry? }.

  // Batch-add summary: render the per-status counts + the first few item
  // names so the user gets an at-a-glance recap of "I added 38, 2 duplicates,
  // 1 not found" without sifting through 40 tool boxes.
  if (toolName === 'add_many_to_next_to_test') {
    // A whole-call failure (e.g. the catalogue read failed): nothing was added.
    if (typeof data.error === 'string') {
      return <p className="text-sm text-destructive">Couldn&apos;t add — {data.error}.</p>
    }
    const summary = (data.summary ?? {}) as {
      added?: number
      duplicate?: number
      not_found?: number
      ambiguous?: number
      error?: number
    }
    const results = (data.results ?? []) as Array<
      | { status: 'added'; name: string; lab: string | null }
      | { status: 'duplicate'; name: string; lab: string | null }
      | { status: 'not_found'; query: string }
      | { status: 'ambiguous'; query: string; candidates: string[] }
      | { status: 'error'; query: string; message: string }
    >
    const added = results.filter((r) => r.status === 'added') as Array<{
      name: string
      lab: string | null
    }>
    const issues = results.filter((r) => r.status !== 'added')
    return (
      <div className="space-y-1 text-sm">
        <p>
          Added <strong>{summary.added ?? 0}</strong>
          {(summary.duplicate ?? 0) > 0 && (
            <>
              {' '}· <span className="text-muted-foreground">
                {summary.duplicate} already on list
              </span>
            </>
          )}
          {(summary.not_found ?? 0) > 0 && (
            <>
              {' '}· <span className="text-muted-foreground">
                {summary.not_found} not found
              </span>
            </>
          )}
          {(summary.ambiguous ?? 0) > 0 && (
            <>
              {' '}· <span className="text-muted-foreground">
                {summary.ambiguous} ambiguous
              </span>
            </>
          )}
          {(summary.error ?? 0) > 0 && (
            <>
              {' '}· <span className="text-destructive">
                {summary.error} errored
              </span>
            </>
          )}
        </p>
        {added.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {added
              .slice(0, 6)
              .map((r) => r.name)
              .join(', ')}
            {added.length > 6 && ` …and ${added.length - 6} more`}
          </p>
        )}
        {issues.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">
              {issues.length} need{issues.length === 1 ? 's' : ''} attention
            </summary>
            <ul className="mt-1 space-y-0.5">
              {issues.slice(0, 10).map((r, i) => (
                <li key={i}>
                  {r.status === 'duplicate'
                    ? `${r.name} — already on list`
                    : r.status === 'not_found'
                      ? `${r.query} — not found`
                      : r.status === 'ambiguous'
                        ? `${r.query} — pick: ${r.candidates.slice(0, 3).join(', ')}`
                        : `${r.query} — ${r.message}`}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    )
  }

  if (toolName === 'add_to_next_to_test') {
    if (data.added && data.entry) {
      const entry = data.entry as {
        name: string
        kind: 'biomarker' | 'lab_test'
        lab?: string | null
      }
      const where = entry.kind === 'biomarker' ? 'Any lab' : (entry.lab ?? '—')
      return (
        <p className="text-sm">
          Added <strong>{entry.name}</strong>{' '}
          <span className="text-muted-foreground">({where})</span>
        </p>
      )
    }
    if (data.error === 'ambiguous') {
      const candidates = (data.candidates as string[] | undefined) ?? []
      return (
        <p className="text-sm text-muted-foreground">
          Multiple matches — pick one:{' '}
          <span className="text-foreground">{candidates.join(', ')}</span>
        </p>
      )
    }
    if (data.error === 'not_found') {
      // Surface what was searched for so the user can see why nothing matched.
      const a = (input ?? {}) as Record<string, unknown>
      const searched =
        (typeof a.biomarkerName === 'string' && a.biomarkerName) ||
        (typeof a.testName === 'string' && a.testName) ||
        ''
      return (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t find {searched ? `"${searched}"` : 'that one'}.
        </p>
      )
    }
    if (data.error === 'duplicate') {
      return (
        <p className="text-sm text-muted-foreground">Already on the list.</p>
      )
    }
    if (data.error) {
      return (
        <p className="text-sm text-destructive">
          Couldn&apos;t add — {String(data.error)}.
        </p>
      )
    }
  }

  if (toolName === 'mark_next_to_test_done') {
    if (data.ok) {
      return <p className="text-sm">Marked done.</p>
    }
    return (
      <p className="text-sm text-muted-foreground">
        Couldn&apos;t mark done (entry may have been removed).
      </p>
    )
  }

  if (toolName === 'remove_from_next_to_test') {
    if (data.ok) {
      return <p className="text-sm">Removed from list.</p>
    }
    return (
      <p className="text-sm text-muted-foreground">
        Couldn&apos;t remove (entry may already be gone).
      </p>
    )
  }

  if (toolName === 'list_next_to_test') {
    // A failed read must not render as an empty list.
    if (typeof data.error === 'string') {
      return (
        <p className="text-sm text-destructive">Couldn&apos;t read the list — {data.error}.</p>
      )
    }
    const entries = (data.entries ?? []) as Array<{
      name: string
      kind: 'biomarker' | 'lab_test'
      lab?: string | null
      list: string
      status: 'pending' | 'done'
    }>
    if (entries.length === 0) {
      return <p className="text-sm text-muted-foreground">List is empty.</p>
    }
    return (
      <div className="space-y-0.5 text-xs">
        {entries.slice(0, 8).map((e, i) => (
          <div key={i} className="flex gap-2 text-muted-foreground">
            <span className="font-medium text-foreground">{e.name}</span>
            <span>
              · {e.kind === 'biomarker' ? 'Any lab' : (e.lab ?? '—')} · {e.list}{' '}
              · {e.status}
            </span>
          </div>
        ))}
        {entries.length > 8 && (
          <p className="text-xs text-muted-foreground">
            …and {entries.length - 8} more
          </p>
        )}
      </div>
    )
  }

  if (toolName === 'lookupMarkerHistory' && data.found === false) {
    return (
      <p className="text-sm text-muted-foreground">
        {(data.message as string) ?? 'No data found.'}
      </p>
    )
  }

  if (toolName === 'lookupMarkerHistory' && data.history) {
    const history = data.history as Array<{
      date: string
      value: number
      unit: string
    }>
    const biomarker = data.biomarker as { name: string }
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium">
          {biomarker.name} — {history.length} result{history.length !== 1 ? 's' : ''}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          {history.slice(-6).map((h) => (
            <span key={h.date}>
              {h.date}: <strong className="text-foreground">{h.value}</strong> {h.unit}
            </span>
          ))}
          {history.length > 6 && (
            <span>...and {history.length - 6} more</span>
          )}
        </div>
      </div>
    )
  }

  if (toolName === 'compareMarkers' && data.markers) {
    const markers = data.markers as Array<{
      name: string
      recentValues: Array<{ date: string; value: number; unit: string }>
      notFound?: boolean
    }>
    return (
      <div className="space-y-1 text-xs">
        {markers.map((m) => (
          <div key={m.name} className="flex gap-2">
            <span className="font-medium">{m.name}:</span>
            {m.notFound ? (
              <span className="text-muted-foreground">not found</span>
            ) : (
              <span className="text-muted-foreground">
                {m.recentValues
                  .map((v) => `${v.value} ${v.unit} (${v.date})`)
                  .join(' → ')}
              </span>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (toolName === 'checkSupplementInteractions') {
    const supplements = (data.supplements ?? []) as Array<{ name: string }>
    return (
      <div className="text-xs text-muted-foreground">
        <span className="font-medium">
          {supplements.length} active supplement{supplements.length !== 1 ? 's' : ''}:
        </span>{' '}
        {supplements.map((s) => s.name).join(', ') || 'none'}
      </div>
    )
  }

  if (toolName === 'web_search' && Array.isArray(result)) {
    // Anthropic web_search output is an array of {url, title, type, pageAge, ...}.
    // Show a tight summary: result count + first few hostnames. The full content
    // ride along as a `source-url` part rendered in the message's Sources footer.
    const results = result as Array<{ url?: string; title?: string }>
    const hosts = results
      .map((r) => {
        if (!r.url) return null
        try {
          return new URL(r.url).hostname.replace(/^www\./, '')
        } catch {
          return null
        }
      })
      .filter((h): h is string => Boolean(h))
    const seen = new Set<string>()
    const uniqueHosts = hosts.filter((h) => (seen.has(h) ? false : (seen.add(h), true)))
    const shown = uniqueHosts.slice(0, 3)
    const remaining = uniqueHosts.length - shown.length
    return (
      <div className="text-xs text-muted-foreground">
        <span className="font-medium">
          {results.length} result{results.length === 1 ? '' : 's'}
        </span>
        {shown.length > 0 && (
          <>
            {' · '}
            {shown.join(', ')}
            {remaining > 0 && ` +${remaining} more`}
          </>
        )}
      </div>
    )
  }

  return (
    <pre className="max-h-20 overflow-auto text-xs text-muted-foreground">
      {JSON.stringify(result, null, 2).slice(0, 200)}
    </pre>
  )
}
