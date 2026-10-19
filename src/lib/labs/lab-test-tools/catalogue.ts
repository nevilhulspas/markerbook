// Pure helpers behind the lab catalogue tools (unit-tested).

import { normalizeTestKey } from '@/lib/labs/normalize'

import type { ExportListItem, FinderBiomarker, FinderTest, LabRow, LabTestMeta } from './types'

/**
 * Resolve free-text lab names (as the model typed them) to approved lab rows.
 * Case-insensitive: first an exact name match, else a substring match in either
 * direction ("Bodimed" ↔ "BODIMED", "Lina" ↔ "Lina Laboratory"). Each input
 * resolves to at most one lab (first match wins); names that match nothing are
 * returned in `unmatched` so the caller can tell the user plainly.
 */
export function resolveLabsByName(
  names: string[],
  labs: LabRow[]
): { matched: LabRow[]; unmatched: string[] } {
  const matched: LabRow[] = []
  const matchedIds = new Set<string>()
  const unmatched: string[] = []

  for (const raw of names) {
    const lab = matchOneLab(raw, labs)
    if (!lab) {
      unmatched.push(raw)
      continue
    }
    if (!matchedIds.has(lab.id)) {
      matchedIds.add(lab.id)
      matched.push(lab)
    }
  }
  return { matched, unmatched }
}

/** Best single approved-lab match for a free-text name, or null. */
export function matchOneLab(name: string, labs: LabRow[]): LabRow | null {
  const q = name.toLowerCase().trim()
  if (q.length === 0) return null
  const exact = labs.find((l) => l.name.toLowerCase().trim() === q)
  if (exact) return exact
  return (
    labs.find((l) => {
      const n = l.name.toLowerCase()
      return n.includes(q) || q.includes(n)
    }) ?? null
  )
}

/**
 * Match the requested test names against a lab's tests (normalized key) and
 * attach metadata. Unmatched names come back with `found:false` so the document
 * can still show what was requested and the model can flag it. Pure.
 */
export function enrichListItems(
  items: { testName: string; reason?: string | null }[],
  labTests: LabTestMeta[]
): ExportListItem[] {
  const byKey = new Map(labTests.map((t) => [normalizeTestKey(t.name), t]))
  return items.map((item) => {
    const t = byKey.get(normalizeTestKey(item.testName))
    if (!t) {
      return {
        testName: item.testName,
        found: false,
        method: null,
        cost: null,
        currency: null,
        turnaround_days: null,
        sample_type: null,
        reason: item.reason ?? null,
      }
    }
    return {
      testName: t.name,
      found: true,
      method: t.method,
      cost: t.cost,
      currency: t.currency,
      turnaround_days: t.turnaround_days,
      sample_type: t.sample_type,
      reason: item.reason ?? null,
    }
  })
}

/**
 * Map raw `lab_tests` rows (with nested `lab_test_biomarkers(biomarkers(...))`)
 * to {@link FinderTest}[], flattening + dropping null biomarker joins. Pure.
 */
export function mapCatalogueRows(rows: unknown[]): FinderTest[] {
  type Row = Omit<FinderTest, 'biomarkers'> & {
    lab_test_biomarkers: { biomarkers: FinderBiomarker | null }[] | null
  }
  return (rows as Row[]).map((r) => ({
    name: r.name,
    method: r.method,
    cost: r.cost,
    currency: r.currency,
    turnaround_days: r.turnaround_days,
    sample_type: r.sample_type,
    provider: r.provider ?? null,
    biomarkers: (r.lab_test_biomarkers ?? [])
      .map((j) => j.biomarkers)
      .filter((b): b is FinderBiomarker => Boolean(b)),
  }))
}
