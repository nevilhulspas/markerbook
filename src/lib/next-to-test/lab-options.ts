// Pure shaping and ranking of lab-test options for a biomarker, used by the
// next-to-test source picker (getLabOptionsForBiomarkers) and the "Add to
// next-to-test" dialog's lab step (getLabTestsForBiomarker). The actions run
// the Supabase queries and hand the rows to these helpers.

export interface LabOptionForBiomarker {
  labId: string
  labName: string
  labTestId: string
  labTestName: string
  // Number of biomarkers the lab_test covers. > 1 means it's a bundle/panel;
  // the picker uses this to demote the row visually with a "panel · N markers"
  // suffix and a divider below the lab's dedicated single-marker test(s).
  markerCount: number
  // Public-catalogue price for the test. Null when the scraper didn't capture
  // a price — picker shows it as "—" in that case.
  cost: number | null
}

// Nested joins are typed object-or-array: many-to-one embeds are single
// objects (what the typed query infers), but the helpers also accept the
// array form so either shape normalises to the first row.
type Lab = { id: string; name: string; status: string }
type LabTest = {
  id: string
  name: string
  cost: number | string | null
  status: string
  labs: Lab | Lab[] | null
}
export type LabOptionRow = { biomarker_id: string; lab_tests: LabTest | LabTest[] | null }

/** A scraped cost as a number: numeric strings parse, anything else is null. */
function parseCost(cost: number | string | null): number | null {
  const n = typeof cost === 'number' ? cost : typeof cost === 'string' ? Number(cost) : NaN
  return Number.isFinite(n) ? n : null
}

// Flattened candidate record keyed by (biomarker_id, lab_id).
export type LabOptionCandidate = {
  biomarkerId: string
  labId: string
  labName: string
  labTestId: string
  labTestName: string
  cost: number // null/invalid → Infinity
}

/**
 * Keep the approved lab tests of approved labs, flattened to candidates, plus
 * the set of lab_test ids seen (the input for the marker-count query).
 */
export function collectLabOptionCandidates(rows: LabOptionRow[]): {
  candidates: LabOptionCandidate[]
  labTestIds: Set<string>
} {
  const candidates: LabOptionCandidate[] = []
  const labTestIds = new Set<string>()
  for (const row of rows) {
    const lt = Array.isArray(row.lab_tests) ? row.lab_tests[0] : row.lab_tests
    if (!lt || lt.status !== 'approved') continue
    const lab = Array.isArray(lt.labs) ? lt.labs[0] : lt.labs
    if (!lab || lab.status !== 'approved') continue
    candidates.push({
      biomarkerId: row.biomarker_id,
      labId: lab.id,
      labName: lab.name,
      labTestId: lt.id,
      labTestName: lt.name,
      cost: parseCost(lt.cost) ?? Number.POSITIVE_INFINITY,
    })
    labTestIds.add(lt.id)
  }
  return { candidates, labTestIds }
}

/** Marker counts per lab_test_id from its lab_test_biomarkers rows. */
export function countMarkersPerLabTest(
  rows: Array<{ lab_test_id: string }>
): Map<string, number> {
  const markerCount = new Map<string, number>()
  for (const r of rows) {
    markerCount.set(r.lab_test_id, (markerCount.get(r.lab_test_id) ?? 0) + 1)
  }
  return markerCount
}

/**
 * Group candidates per biomarker and rank them: labs alphabetical, and within
 * a lab the preferred (currently pinned) test, then fewest markers, cheapest,
 * shortest name, id.
 */
export function rankLabOptions(
  candidates: LabOptionCandidate[],
  markerCount: Map<string, number>,
  preferredLabTestIds: string[]
): Record<string, LabOptionForBiomarker[]> {
  const preferred = new Set(preferredLabTestIds)
  // The count read is complete (paged), so a lab test is missing from the map
  // only when that read failed. Its real count is then unknown — often a big
  // panel — so it ranks after every counted test rather than passing as a
  // dedicated single-marker one; the picker shows it without a panel tag.
  const rankCountOf = (labTestId: string) =>
    markerCount.get(labTestId) ?? Number.POSITIVE_INFINITY

  // Stable comparator for ranking within a lab (and as the secondary order
  // across labs after the lab-name primary).
  const compareCandidates = (a: LabOptionCandidate, b: LabOptionCandidate): number => {
    // 1. Preferred (user is currently on it) wins.
    const aPref = preferred.has(a.labTestId)
    const bPref = preferred.has(b.labTestId)
    if (aPref !== bPref) return aPref ? -1 : 1
    // 2. Fewest biomarker mappings.
    const aCount = rankCountOf(a.labTestId)
    const bCount = rankCountOf(b.labTestId)
    if (aCount !== bCount) return aCount - bCount
    // 3. Cheapest cost.
    if (a.cost !== b.cost) return a.cost - b.cost
    // 4. Shortest name (most direct match to biomarker).
    if (a.labTestName.length !== b.labTestName.length) {
      return a.labTestName.length - b.labTestName.length
    }
    // 5. Deterministic tie-break.
    return a.labTestId.localeCompare(b.labTestId)
  }

  // Build the per-biomarker list. Every candidate is kept (we don't dedup
  // away the bundles any more — the picker visually separates them); the
  // sort ensures each lab's dedicated test(s) come before its bundles, and
  // labs are alphabetical.
  const out: Record<string, LabOptionForBiomarker[]> = {}
  for (const c of candidates) {
    const list = out[c.biomarkerId] ?? []
    list.push({
      labId: c.labId,
      labName: c.labName,
      labTestId: c.labTestId,
      labTestName: c.labTestName,
      markerCount: markerCount.get(c.labTestId) ?? 1,
      cost: Number.isFinite(c.cost) ? c.cost : null,
    })
    out[c.biomarkerId] = list
  }
  // Sort each biomarker's list: alphabetical by lab name, then in-lab rank.
  // A second pass instead of building per-lab groups keeps the picker's
  // input flat — the UI renders dividers based on lab transitions and
  // the markerCount delta.
  for (const bmId of Object.keys(out)) {
    out[bmId].sort((a, b) => {
      const labCmp = a.labName.localeCompare(b.labName)
      if (labCmp !== 0) return labCmp
      // Same lab — use the rich candidate comparator. Look the candidates
      // back up via labTestId so the rank includes the preferred/cost
      // signals captured during the main pass.
      const ca = candidates.find((c) => c.labTestId === a.labTestId)!
      const cb = candidates.find((c) => c.labTestId === b.labTestId)!
      return compareCandidates(ca, cb)
    })
  }
  return out
}

// ---------- "Add to next-to-test" dialog lab step ----------

export interface LabTestForBiomarker {
  labTestId: string
  testName: string
  labName: string
  cost: number | null
  currency: string | null
}

export type LabTestForBiomarkerRow = {
  lab_test_id: string
  lab_tests: {
    id: string
    name: string
    cost: number | string | null
    currency: string | null
    status: string
    labs: { id: string; name: string; status: string } | { id: string; name: string; status: string }[] | null
  } | { id: string; name: string; cost: number | string | null; currency: string | null; status: string; labs: unknown }[]
}

/**
 * Approved lab tests of approved labs, sorted by lab name then test name.
 */
export function toLabTestsForBiomarker(rows: LabTestForBiomarkerRow[]): LabTestForBiomarker[] {
  const out: LabTestForBiomarker[] = []
  for (const r of rows) {
    const lt = Array.isArray(r.lab_tests) ? r.lab_tests[0] : r.lab_tests
    if (!lt || lt.status !== 'approved') continue
    const lab = Array.isArray(lt.labs) ? lt.labs[0] : lt.labs
    if (!lab || (lab as { status: string }).status !== 'approved') continue
    out.push({
      labTestId: lt.id,
      testName: lt.name,
      labName: (lab as { name: string }).name,
      cost: parseCost(lt.cost),
      currency: lt.currency,
    })
  }
  // Stable sort: lab name asc, then test name asc.
  out.sort((a, b) => a.labName.localeCompare(b.labName) || a.testName.localeCompare(b.testName))
  return out
}
