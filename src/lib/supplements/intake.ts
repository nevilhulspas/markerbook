import type {
  SupplementIntake,
  SupplementWithIntakes,
} from '@/lib/database.types'

/**
 * Postgres TIME comes back as "HH:MM:SS"; the app works in "HH:MM". Anything
 * already normalized passes through, so this is safe to apply twice.
 */
export function normalizeTime(t: string): string {
  return t.slice(0, 5)
}

/**
 * The Frequency shown in the UI, the PDF and the chat tools. Derived from the
 * intake moments, never stored — a stored copy would drift the moment someone
 * edits the times. Supplements that predate intake moments keep showing their
 * legacy free-text frequency until times are filled in.
 *
 * Pass `endDate` for entries that may have stopped: a schedule on a stopped
 * supplement is history, and reporting a bare "2x daily" tells the AI the user
 * still takes something they stopped.
 */
export function deriveFrequency(
  intakes: SupplementIntake[],
  legacy: string | null,
  endDate?: string | null
): string | null {
  if (intakes.length === 0) return legacy
  const schedule = `${intakes.length}x daily`
  return endDate ? `${schedule} (when taken)` : schedule
}

export type IntakeGroup = {
  /** "08:00", or null for the trailing "no time set" group. */
  time: string | null
  rows: { supplement: SupplementWithIntakes; amount: string | null }[]
}

const byName = (
  a: { supplement: SupplementWithIntakes },
  b: { supplement: SupplementWithIntakes }
) =>
  a.supplement.name.localeCompare(b.supplement.name, undefined, {
    sensitivity: 'base',
  })

/**
 * One group per distinct intake time, ascending, with a supplement appearing
 * once per moment it has. Supplements with no moments collapse into a single
 * trailing group keyed `null` so nothing ever drops off the Stack.
 */
export function groupByIntakeTime(
  supplements: SupplementWithIntakes[]
): IntakeGroup[] {
  const timed = new Map<string, IntakeGroup['rows']>()
  const untimed: IntakeGroup['rows'] = []

  for (const supplement of supplements) {
    if (supplement.intakes.length === 0) {
      untimed.push({ supplement, amount: null })
      continue
    }
    for (const intake of supplement.intakes) {
      const time = normalizeTime(intake.time)
      const rows = timed.get(time) ?? []
      rows.push({ supplement, amount: intake.amount })
      timed.set(time, rows)
    }
  }

  const groups: IntakeGroup[] = [...timed.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, rows]) => ({ time, rows: [...rows].sort(byName) }))

  if (untimed.length > 0) {
    groups.push({ time: null, rows: [...untimed].sort(byName) })
  }
  return groups
}
