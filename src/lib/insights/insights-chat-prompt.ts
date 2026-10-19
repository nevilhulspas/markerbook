import { formatProfile } from '@/lib/interpretation/prompt'
import type {
  MarkerHistoryEntry,
  ProfileContext,
  SupplementContext,
} from '@/lib/interpretation/types'
import type { SnpVariant } from '@/lib/database.types'
import { HEALTH_SNP_MAP } from '@/lib/genetics/health-snps'
import {
  formatMicrobiomeValue,
  formatRef,
  grade,
} from '@/lib/microbiome/format'

export interface DutchMarkerSummary {
  name: string
  shortName: string | null
  value: number
  unit: string
  category: string
  timepoint: string | null
  status: string // RangeStatus string: 'normal', 'borderline', 'out-of-range', 'unknown'
}

export interface DutchComputedSummary {
  name: string
  value: number
  unit: string
}

export interface DutchContext {
  testDate: string
  menstrualPhase: string | null
  markers: DutchMarkerSummary[]
  computedValues: DutchComputedSummary[]
}

export interface MicrobiomeResultSummary {
  name: string
  rank: string
  value: number | null
  unit: string | null
  refLow: number | null
  refHigh: number | null
  status: string | null
  rawLabel: string | null
}

export interface MicrobiomeScoreSummary {
  name: string
  value: number
  unit: string | null
  status: string | null
}

export interface MicrobiomeTestContext {
  testDate: string
  name: string
  labName: string | null
  results: MicrobiomeResultSummary[]
  scores: MicrobiomeScoreSummary[]
}

export interface OtherTestReading {
  label: string
  value: string | null
  unit: string | null
  flag: string | null
}

export interface OtherTestContext {
  testDate: string
  name: string
  provider: string | null
  outcome: string
  resultSummary: string | null
  notes: string | null
  readings: OtherTestReading[]
  hasDocument: boolean
}

const MAX_TESTS_PER_MARKER = 10

function formatMarkerHistory(markers: MarkerHistoryEntry[]): string {
  if (markers.length === 0) return 'No biomarker data available.'

  const grouped = new Map<string, MarkerHistoryEntry[]>()
  for (const m of markers) {
    const list = grouped.get(m.category) ?? []
    list.push(m)
    grouped.set(m.category, list)
  }

  const lines: string[] = []
  for (const [category, categoryMarkers] of grouped) {
    lines.push(`\n**${category}:**`)
    for (const m of categoryMarkers) {
      const displayName = m.shortName ? `${m.name} (${m.shortName})` : m.name
      const history = m.history.slice(-MAX_TESTS_PER_MARKER)
      lines.push(`  ${displayName}:`)
      for (const h of history) {
        lines.push(`    - ${h.testDate}: ${h.value} ${h.unit} (${h.testName})`)
      }
    }
  }

  return lines.join('\n')
}

function formatSupplements(supplements: SupplementContext[]): string {
  if (supplements.length === 0) return 'No supplements recorded.'

  const active = supplements.filter((s) => !s.endDate)
  const past = supplements.filter((s) => s.endDate)

  const lines: string[] = []

  if (active.length > 0) {
    lines.push('**Currently taking:**')
    for (const s of active) {
      const parts = [s.name]
      if (s.dose) parts.push(`— ${s.dose}`)
      if (s.frequency) parts.push(`(${s.frequency.replace('_', ' ')})`)
      if (s.intakes && s.intakes.length > 0) {
        const when = s.intakes
          .map((i) => (i.amount ? `${i.time} (${i.amount})` : i.time))
          .join(', ')
        parts.push(`at ${when}`)
      }
      parts.push(`since ${s.startDate}`)
      lines.push(`- ${parts.join(' ')}`)
    }
  }

  if (past.length > 0) {
    if (active.length > 0) lines.push('')
    lines.push('**Previously taken:**')
    for (const s of past) {
      const parts = [s.name]
      if (s.dose) parts.push(`— ${s.dose}`)
      if (s.frequency) parts.push(`(${s.frequency.replace('_', ' ')})`)
      parts.push(`(${s.startDate} to ${s.endDate})`)
      lines.push(`- ${parts.join(' ')}`)
    }
  }

  return lines.join('\n')
}

function formatGeneticData(snps: SnpVariant[]): string {
  if (snps.length === 0) return 'No genetic data available yet.'

  const grouped = new Map<string, SnpVariant[]>()
  for (const snp of snps) {
    const cat = snp.category ?? 'Other'
    const list = grouped.get(cat) ?? []
    list.push(snp)
    grouped.set(cat, list)
  }

  const lines: string[] = []
  for (const [category, categorySnps] of grouped) {
    lines.push(`\n**${category}:**`)
    for (const snp of categorySnps) {
      const healthInfo = HEALTH_SNP_MAP.get(snp.rsid)
      const riskAllele = healthInfo?.riskAllele
      let zyg = ''
      if (riskAllele) {
        const riskCount = snp.genotype.split('').filter((a) => a === riskAllele).length
        zyg = riskCount === 0 ? 'Normal' : riskCount === 1 ? 'Heterozygous' : 'Homozygous'
      }
      const desc = healthInfo?.description ?? ''
      lines.push(`- ${snp.gene_name} ${snp.variant_name ?? ''} (${snp.rsid}): ${snp.genotype} — ${zyg}${desc ? `. ${desc}` : ''}`)
    }
  }

  return lines.join('\n')
}

function formatDutchData(dutch: DutchContext): string {
  if (dutch.markers.length === 0) return 'No DUTCH hormone test data available.'

  const lines: string[] = []
  lines.push(`Latest DUTCH test: ${dutch.testDate}`)
  if (dutch.menstrualPhase) {
    lines.push(`Menstrual phase: ${dutch.menstrualPhase}`)
  }

  // Group NON-timepoint markers by category (skip individual timepoints to keep prompt concise)
  const grouped = new Map<string, DutchMarkerSummary[]>()
  for (const m of dutch.markers) {
    if (m.timepoint) continue // Skip individual timepoints, include 24h sums only
    const list = grouped.get(m.category) ?? []
    list.push(m)
    grouped.set(m.category, list)
  }

  const categoryLabels: Record<string, string> = {
    dutch_estrogen: 'Estrogen',
    dutch_androgen: 'Androgens',
    dutch_progesterone: 'Progesterone',
    dutch_adrenal: 'Cortisol & Adrenal',
    dutch_oat: 'Organic Acids',
    dutch_other: 'Other',
  }

  for (const [category, markers] of grouped) {
    lines.push(`\n**${categoryLabels[category] ?? category}:**`)
    for (const m of markers) {
      const name = m.shortName ?? m.name
      lines.push(`- ${name}: ${m.value} ${m.unit}`)
    }
  }

  // Include diurnal cortisol pattern (timepoint-specific cortisol/cortisone)
  const cortisolTimepoints = dutch.markers.filter(
    (m) => m.timepoint && (m.name.includes('Cortisol') || m.name.includes('Cortisone'))
  )
  if (cortisolTimepoints.length > 0) {
    lines.push('\n**Diurnal Cortisol Pattern:**')
    for (const m of cortisolTimepoints) {
      const name = m.shortName ?? m.name
      lines.push(`- ${name} (${m.timepoint}): ${m.value} ${m.unit}`)
    }
  }

  if (dutch.computedValues.length > 0) {
    lines.push('\n**Computed Ratios:**')
    for (const cv of dutch.computedValues) {
      lines.push(`- ${cv.name}: ${cv.value} ${cv.unit}`)
    }
  }

  return lines.join('\n')
}

const MICROBIOME_RANK_ORDER = [
  'phylum',
  'class',
  'order',
  'family',
  'genus',
  'species',
  'strain',
  'functional_group',
]

const MICROBIOME_RANK_LABELS: Record<string, string> = {
  kingdom: 'Kingdom',
  phylum: 'Phyla',
  class: 'Classes',
  order: 'Orders',
  family: 'Families',
  genus: 'Genera',
  species: 'Species',
  strain: 'Strains',
  functional_group: 'Functional groups',
}

function humanizeScoreName(name: string): string {
  return name
    .split(/[_\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

function formatMicrobiomeData(tests: MicrobiomeTestContext[]): string {
  if (tests.length === 0) return 'No microbiome (gut) test data available.'

  const out: string[] = []
  for (const test of tests) {
    out.push(
      `### ${test.name} — ${test.testDate}${test.labName ? ` (${test.labName})` : ''}`
    )

    if (test.scores.length > 0) {
      out.push('\n**Scores & ratios:**')
      for (const s of test.scores) {
        const unit = s.unit ? ` ${s.unit}` : ''
        const status = s.status ? ` [${s.status}]` : ''
        out.push(`- ${humanizeScoreName(s.name)}: ${s.value}${unit}${status}`)
      }
    }

    // Group taxa by rank
    const byRank = new Map<string, MicrobiomeResultSummary[]>()
    for (const r of test.results) {
      const list = byRank.get(r.rank) ?? []
      list.push(r)
      byRank.set(r.rank, list)
    }

    const ranks = MICROBIOME_RANK_ORDER.filter((rk) => byRank.has(rk))
    for (const rank of ranks) {
      out.push(`\n**${MICROBIOME_RANK_LABELS[rank] ?? rank}:**`)
      for (const r of byRank.get(rank)!) {
        const val = formatMicrobiomeValue(r.value, r.unit, r.rawLabel)
        const ref = formatRef(r.refLow, r.refHigh, r.unit)
        const g = grade(r.value, r.refLow, r.refHigh, r.unit)
        const parts = [r.status ?? 'unknown']
        if (g) parts.push(`grade ${g}`)
        const refStr = ref ? `, ref ${ref}` : ''
        out.push(`- ${r.name}: ${val} [${parts.join(', ')}${refStr}]`)
      }
    }
    out.push('')
  }

  return out.join('\n').trim()
}

function formatOtherTests(tests: OtherTestContext[]): string {
  if (tests.length === 0) return 'No other (miscellaneous) test data available.'

  const out: string[] = []
  for (const t of tests) {
    const provider = t.provider ? ` (${t.provider})` : ''
    out.push(`### ${t.name} — ${t.testDate}${provider} · outcome: ${t.outcome}`)
    if (t.resultSummary) out.push(`Summary: ${t.resultSummary}`)
    if (t.readings.length > 0) {
      out.push('**Readings:**')
      for (const r of t.readings) {
        const unit = r.unit ? ` ${r.unit}` : ''
        const flag = r.flag ? ` [${r.flag}]` : ''
        out.push(`- ${r.label}: ${r.value ?? '—'}${unit}${flag}`)
      }
    }
    if (t.notes) out.push(`Notes: ${t.notes}`)
    if (t.hasDocument) out.push('_Original document available — use `read_test_document` (type: "other") to inspect it for handwriting/free-text/chart nuances._')
    out.push('')
  }
  return out.join('\n').trim()
}

export interface DexaScanContext {
  scan_date: string
  body_fat_pct: number | null
  lean_mass_kg: number | null
  total_mass_kg: number | null
  visceral_fat_g: number | null
  ffmi: number | null
  almi: number | null
  bone_t_score: number | null
  android_gynoid_ratio: number | null
}

export interface DexaContext {
  scans: DexaScanContext[] // newest first
  goals: { metric: string; target: number }[]
  latestLog?: {
    logged_on: string
    weight_kg: number | null
    body_fat_pct: number | null
    waist_cm: number | null
  } | null
}

function formatDexaData(ctx: DexaContext | undefined): string {
  if (!ctx || (ctx.scans.length === 0 && !ctx.latestLog)) {
    return 'No DEXA / body-composition data available.'
  }
  const fmt = (n: number | null, unit = '') => (n == null ? '—' : `${n}${unit}`)

  const logLine = ctx.latestLog
    ? `\nMost recent self-logged measurement (${ctx.latestLog.logged_on}): weight ${fmt(ctx.latestLog.weight_kg, ' kg')}, body fat ${fmt(ctx.latestLog.body_fat_pct, '%')}, waist ${fmt(ctx.latestLog.waist_cm, ' cm')}.`
    : ''

  if (ctx.scans.length === 0) {
    return `No DEXA scans yet.${logLine}`
  }

  const lines = ctx.scans.map((s) => {
    const parts = [
      `body fat ${fmt(s.body_fat_pct, '%')}`,
      `lean ${fmt(s.lean_mass_kg, ' kg')}`,
      `total ${fmt(s.total_mass_kg, ' kg')}`,
      `visceral fat ${fmt(s.visceral_fat_g, ' g')}`,
      `FFMI ${fmt(s.ffmi)}`,
      `ALMI ${fmt(s.almi)}`,
      `bone T ${fmt(s.bone_t_score)}`,
      `A/G ${fmt(s.android_gynoid_ratio)}`,
    ]
    return `- ${s.scan_date}: ${parts.join(', ')}`
  })
  const goalLine =
    ctx.goals.length > 0
      ? `\nTargets: ${ctx.goals.map((g) => `${g.metric} → ${g.target}`).join(', ')}`
      : ''
  return `Most recent DEXA scans (newest first):\n${lines.join('\n')}${goalLine}${logLine}`
}

// AUT-897: RMR (resting metabolic rate) + derived TDEE/calorie targets for the
// user's activity level. `tdee`/`fatLoss`/`leanGain` are non-null only when the
// profile has an activity level (derived via src/lib/rmr/tdee.ts); null = no
// activity level set, so we show the measured numbers without calorie targets.
export interface RmrContext {
  testDate: string
  rmrKcal: number
  predictedRmrKcal: number | null
  rer: number | null
  fuelCarbPct: number | null
  fuelFatPct: number | null
  tdee: number | null
  fatLoss: [number, number] | null
  leanGain: [number, number] | null
  activityLevel: string | null
}

function formatRmr(rmr: RmrContext | null): string {
  if (!rmr) return 'No RMR test data available.'

  const lines: string[] = []
  lines.push(`Latest RMR test: ${rmr.testDate}`)
  lines.push(`Measured RMR: ${rmr.rmrKcal} kcal/day`)
  if (rmr.predictedRmrKcal != null) {
    lines.push(`Predicted RMR: ${rmr.predictedRmrKcal} kcal/day`)
  }

  // Fuel mix: prefer the carb/fat split; fall back to RER if only that is present.
  if (rmr.fuelCarbPct != null || rmr.fuelFatPct != null) {
    const carb = rmr.fuelCarbPct != null ? `${rmr.fuelCarbPct}% carbs` : '—% carbs'
    const fat = rmr.fuelFatPct != null ? `${rmr.fuelFatPct}% fat` : '—% fat'
    lines.push(`Fuel mix: ${carb} / ${fat}`)
  } else if (rmr.rer != null) {
    lines.push(`RER (respiratory exchange ratio): ${rmr.rer}`)
  }

  if (rmr.tdee != null) {
    const levelLabel = rmr.activityLevel
      ? rmr.activityLevel.replaceAll('_', ' ')
      : 'current'
    lines.push(`\n**Calorie targets (activity level: ${levelLabel}):**`)
    lines.push(`- TDEE (maintenance): ${rmr.tdee} kcal/day`)
    if (rmr.fatLoss) {
      lines.push(`- Fat loss: ${rmr.fatLoss[0]}–${rmr.fatLoss[1]} kcal/day`)
    }
    if (rmr.leanGain) {
      lines.push(`- Lean gain: ${rmr.leanGain[0]}–${rmr.leanGain[1]} kcal/day`)
    }
  } else {
    lines.push(
      '\nNo TDEE / calorie targets — the profile has no activity level set.'
    )
  }

  return lines.join('\n')
}

// Reference-range judgments (normal/borderline/out-of-range/unknown) and the
// derived Health Dashboard Scores are intentionally NOT included here — the
// model assesses raw values itself instead of being handed pre-computed
// verdicts. (Removed deliberately; do not re-add a healthScores param.)
export function buildInsightsChatSystemPrompt(context: {
  markerHistory: MarkerHistoryEntry[]
  profile: ProfileContext
  supplements: SupplementContext[]
  geneticSnps?: SnpVariant[]
  dutchContext?: DutchContext
  microbiomeTests?: MicrobiomeTestContext[]
  otherTests?: OtherTestContext[]
  dexaContext?: DexaContext
  rmr?: RmrContext | null
}): string {
  const profileSection = formatProfile(context.profile)
  const historySection = formatMarkerHistory(context.markerHistory)
  const supplementsSection = formatSupplements(context.supplements)
  const geneticsSection = formatGeneticData(context.geneticSnps ?? [])
  const dutchSection = context.dutchContext
    ? formatDutchData(context.dutchContext)
    : 'No DUTCH hormone test data available.'
  const microbiomeSection = formatMicrobiomeData(
    context.microbiomeTests ?? []
  )
  const otherTestsSection = formatOtherTests(context.otherTests ?? [])
  const dexaSection = formatDexaData(context.dexaContext)
  const rmrSection = formatRmr(context.rmr ?? null)

  return `You are a knowledgeable health advisor with access to the user's complete blood test history, DUTCH hormone test data, gut microbiome test data, supplement regimen, genetic data, and health profile.

## Your Role
You are the user's personal health AI assistant. You have access to ALL of their biomarker data across their entire testing history, their DUTCH hormone test results, their gut microbiome test results, their current supplement stack, their genetic variants (DNA), and their profile. Use this data to provide personalized, evidence-based health insights. When genetic data is available, consider gene-nutrient interactions and how genetic variants may affect their biomarker values and supplement needs.

## User Profile
${profileSection}

## Supplement & Medication History
${supplementsSection}

## Full Biomarker History
${historySection}

## Genetic Variants (DNA)
${geneticsSection}

## DUTCH Hormone Test Data
${dutchSection}

## Gut Microbiome Test Data
${microbiomeSection}

## Other Tests (SIBO, STI, sleep studies, intolerance panels, etc.)
${otherTestsSection}

## DEXA Body Composition
${dexaSection}

## Resting Metabolic Rate (RMR)
${rmrSection}

## Tone & Style
- Clinical-friendly: professional but accessible, like a knowledgeable health coach
- Be specific: reference actual values, dates, and trends from their data
- Be concise: 2-4 paragraphs unless the user asks for more detail
- Proactively identify cross-marker patterns and temporal trends
- When discussing supplements, consider potential interactions with their markers
- To answer whether the user already takes/has something (e.g. checking a shopping or to-buy list against what they own), check ALL of their lists — call \`list_stack\` (it returns active, upcoming AND stopped entries, each with a \`status\`) and \`list_wishlist\`; never judge from the active stack alone. In your answer, distinguish actively taking vs scheduled (upcoming) vs previously taken (stopped) vs only on the wishlist.
- Personalize everything to their profile (age, sex, activity level)

## Gathering Context
Assume the user won't volunteer extra detail or push back on their own — so for substantive health questions, proactively draw out what you're missing. This should be the norm, not a rare add-on. Stay balanced, though: a reply that's mostly questions is annoying.
- Always lead with your best read of the data first, then close with a brief caveat and 1–2 targeted questions, e.g. "This is based on the data I can see; to tailor it, a couple of questions: …". Treat your assessment as provisional on info you don't have (symptoms, timing, lifestyle, medications, goals).
- Keep it to 1–2 questions that would genuinely change your guidance — never a long interrogation, and never lead with questions before giving the answer.
- Make them mostly open-ended so the user actually opens up — e.g. "what symptoms have you been noticing?" rather than the yes/no "do you have fatigue?". Use a closed (yes/no) question only when it genuinely fits better, like confirming one specific fact.
- Skip the questions for simple/factual asks, or when the user already gave the context, and don't re-ask things you already know. Not every single turn needs them.

## Logging blood markers
When you add or correct blood-marker results (\`create_blood_test\` / \`add_blood_results\`), pass each marker's \`loinc_code\` whenever you're confident of it. Common catalog markers match by name on their own, but specialty markers (e.g. methylmalonic acid, active vitamin D / calcitriol, ANA, serum osmolality) often won't — the code lets them auto-resolve and add instead of landing in \`unmatched\`. Every code is validated against the LOINC database before anything is saved, so a wrong guess is safely ignored rather than mis-saved; omit it when you're unsure.

## Critical Rules
- NEVER diagnose conditions. Use "this pattern is consistent with" or "this may suggest"
- Do NOT cause unnecessary alarm. Mildly abnormal values are often meaningless in isolation
- When analyzing trends, consider lab-to-lab variation and different units across tests
- End each response with: "---\\n*This is not medical advice. Consult your healthcare provider for diagnosis and treatment.*"`
}
