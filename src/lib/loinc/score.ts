import type { BiomarkerToMatch, LoincTerm, ScoredCandidate } from './types'

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Preferred LOINC `system` axes per specimen. A biomarker measured in blood should
// match a blood-ish system; a urine marker (e.g. "Creatinine (Urine)") should match
// the Urine system — and for it, blood systems are the off-specimen ones. The target
// specimen is inferred from the biomarker name (see the match script).
const BLOOD_SYSTEMS = new Set(['ser/plas', 'ser', 'plas', 'bld', 'bldc', 'bldv', 'blda', 'bldmv'])
const URINE_SYSTEMS = new Set(['urine'])

function preferredSystems(specimen: 'blood' | 'urine' | null | undefined): Set<string> {
  return specimen === 'urine' ? URINE_SYSTEMS : BLOOD_SYSTEMS
}

// Among the preferred (blood-ish) systems, the generic specimens (Ser/Plas, then Ser
// / Plas, then whole Bld) are the canonical lab terms; the site-qualified blood codes
// (BldA arterial, BldV venous, BldC capillary, BldMV mixed venous) are special-cases.
// This is a sub-bonus *tie-breaker* (max 0.04, below the granularity of every real
// bonus/penalty) so it only orders otherwise-equal candidates — e.g. it picks the
// canonical "Hemoglobin in Bld" (718-7) over "in BldA" (30313-1), and "Creatinine in
// Ser/Plas" (2160-0) over "in BldA" (21232-4) — without reordering real score gaps.
const SPECIMEN_RANK: Record<string, number> = {
  'ser/plas': 0.04,
  ser: 0.03,
  plas: 0.03,
  bld: 0.02,
  bldv: 0.01,
  blda: 0.01,
  bldc: 0.01,
  bldmv: 0.01,
  urine: 0.02,
}

/** Generic-specimen preference (see SPECIMEN_RANK). Used both as a sub-bonus and as a
 *  sort tie-breaker so the preference survives even when confidence clamps to 1.0. */
function specimenRankOf(system: string | null): number {
  return SPECIMEN_RANK[(system ?? '').toLowerCase()] ?? 0
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(normalizeName(a).split(' ').filter(Boolean))
  const tb = new Set(normalizeName(b).split(' ').filter(Boolean))
  if (ta.size === 0 || tb.size === 0) return 0
  let hit = 0
  for (const t of ta) if (tb.has(t)) hit++
  return hit / Math.max(ta.size, tb.size)
}

/**
 * Detect the immunoglobulin class a string refers to — IgA / IgG / IgM / IgE.
 * Used on both sides: the biomarker (e.g. "Anti-DGP IgA") and the LOINC component
 * (e.g. "Gliadin peptide Ab.IgA"). Returns the class letter or null.
 */
function igClass(s: string): 'A' | 'G' | 'M' | 'E' | null {
  const m = /\bIg([AGME])\b/i.exec(s)
  return m ? (m[1].toUpperCase() as 'A' | 'G' | 'M' | 'E') : null
}

/** A combined immunoglobulin component, e.g. "…Ab.IgA+IgG" — never the right match
 *  for a single-class biomarker. */
const COMBINED_IG = /Ig[AGME]\s*\+\s*Ig[AGME]/i

/**
 * True when a LOINC term's COMPONENT is a ratio / composite of two analytes —
 * "Calcium/Osmolality" (a "/" joins two analytes) or an explicit "ratio" in the
 * component text. Used to stop a simple analyte from matching such a term on a
 * shared token ("Osmolality" is only one token of "Calcium/Osmolality").
 *
 * Detection is COMPONENT-based, NOT PROPERTY-based. A ratio PROPERTY (*Rto) also
 * tags single-concept markers like INR (component "INR", property "RelRto"), whose
 * decorated labels ("PT INR", "INR (PT)") aren't exact component matches and would
 * be wrongly penalized below CONFIDENCE_THRESHOLD. Real composite ratios always
 * carry a "/" in the component, so the "/" check covers the actual false-positive
 * class without that collateral damage.
 */
function isRatioComponent(c: LoincTerm): boolean {
  return c.component.includes('/') || /\bratio\b/i.test(c.component)
}

/**
 * Rank local LOINC terms for a biomarker. Deterministic, pure, axis-aware.
 *
 * Scoring model (see AUT-904 spec): a name/token base, plus axis bonuses for the
 * preferred specimen, a quantitative scale, method-less terms, and a matching unit;
 * minus penalties for off-specimen, non-quantitative scales, panels, and — critically
 * — immunoglobulin-class mismatch (a single-class marker must not match a combined or
 * different-class term).
 */
export function rankCandidates(
  bm: BiomarkerToMatch,
  candidates: LoincTerm[],
): ScoredCandidate[] {
  const names = [bm.name, bm.shortName ?? '', ...bm.aliases].filter(Boolean)
  const normNames = names.map(normalizeName).filter(Boolean)
  // The biomarker's own Ig class is read across its name + aliases combined.
  const bmIg = igClass([bm.name, ...bm.aliases].join(' '))
  // Whether the biomarker is itself a ratio ("Albumin/Globulin ratio") — if so, a
  // ratio LOINC term is the *correct* target and must not be penalized below.
  const bmIsRatio = names.some((n) => n.includes('/') || /\bratio\b/i.test(n))
  // Which LOINC systems to prefer depends on the biomarker's specimen (blood default).
  const preferred = preferredSystems(bm.specimen)

  return candidates
    .map((c) => {
      // Exact component match (e.g. "Hemoglobin" === "Hemoglobin") is the strongest
      // signal — it must beat partial overlaps like "Hemoglobin J - Capetown".
      const exact = normNames.includes(normalizeName(c.component))
      const tokenScore =
        names.length === 0
          ? 0
          : Math.max(
              ...names.map((n) =>
                Math.max(tokenOverlap(n, c.component), tokenOverlap(n, c.longCommonName)),
              ),
            )
      const base = exact ? 1 : tokenScore

      const sys = (c.system ?? '').toLowerCase()
      const systemBonus = preferred.has(sys) ? 0.1 : 0
      const specimenRank = preferred.has(sys) ? specimenRankOf(c.system) : 0 // sub-bonus tie-breaker (see above)
      const offSpecimenPenalty = sys && !preferred.has(sys) ? 0.2 : 0

      const scaleBonus = c.scaleTyp === 'Qn' ? 0.05 : 0
      const nonQnPenalty = c.scaleTyp && c.scaleTyp !== 'Qn' ? 0.15 : 0

      const methodBonus = c.methodTyp ? 0 : 0.05 // prefer the generic, method-less term

      const unitBonus =
        bm.currentUnit &&
        c.ucumUnit &&
        normalizeName(bm.currentUnit) === normalizeName(c.ucumUnit)
          ? 0.05
          : 0

      const panelPenalty =
        /\bpanel\b/i.test(c.component) || /\bpanel\b/i.test(c.longCommonName) ? 0.25 : 0

      // Ratio / composite-analyte discrimination. A term like "Calcium/Osmolality"
      // (a ratio of two analytes) is the wrong target for a single analyte whose
      // name is merely a shared token ("Osmolality"). Penalize it heavily — enough
      // to drop a shared-token match below CONFIDENCE_THRESHOLD — but skip the
      // penalty when the biomarker is itself a ratio, or when its name matches the
      // composite component exactly.
      const ratioPenalty = !exact && !bmIsRatio && isRatioComponent(c) ? 0.4 : 0

      // Immunoglobulin-class discrimination.
      let igPenalty = 0
      if (bmIg) {
        if (COMBINED_IG.test(c.component)) igPenalty = 0.4
        else {
          const candIg = igClass(c.component)
          if (candIg && candIg !== bmIg) igPenalty = 0.5
        }
      }

      const confidence = clamp01(
        round2(
          base * 0.75 +
            systemBonus +
            specimenRank +
            scaleBonus +
            methodBonus +
            unitBonus -
            offSpecimenPenalty -
            nonQnPenalty -
            panelPenalty -
            ratioPenalty -
            igPenalty,
        ),
      )
      return { ...c, confidence }
    })
    .sort(
      (a, b) =>
        b.confidence - a.confidence ||
        // Generic specimen wins ties even after the confidence clamp (e.g. Hemoglobin
        // in Bld (718-7) over BldA (30313-1) when both clamp to 1.0).
        specimenRankOf(b.system) - specimenRankOf(a.system) ||
        a.code.localeCompare(b.code),
    )
}
