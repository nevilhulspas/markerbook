export interface LoincCandidate {
  code: string // LOINC_NUM, e.g. "718-7"
  longName: string // LONG_COMMON_NAME (encodes specimen + property)
  component: string // analyte
  ucumUnit: string | null // from units[i][0].unit
  method: string | null // METHOD_TYP, '' -> null
  property: string | null // PROPERTY, e.g. 'MCnc' | 'SCnc' | 'Imp'
}

/**
 * A LOINC term as loaded from the local `loinc_terms` table (the official release).
 * This is what the local, axis-aware matcher scores against — it carries the full
 * set of axes (system / scale / method) the scorer needs.
 */
export interface LoincTerm {
  code: string // loinc_num
  component: string
  property: string | null
  system: string | null
  scaleTyp: string | null
  methodTyp: string | null
  longCommonName: string
  shortName: string | null
  ucumUnit: string | null // example_ucum_units
  classtype: number | null
  status: string | null
}

/** The specimen a biomarker is measured in — drives which LOINC `system` to prefer.
 *  Inferred from the biomarker name (e.g. "(Urine)"). Defaults to blood. */
export type Specimen = 'blood' | 'urine'

export interface BiomarkerToMatch {
  id: string
  name: string
  shortName: string | null
  aliases: string[]
  category: string
  currentUnit: string | null
  userValueCount: number
  specimen?: Specimen | null // undefined/null = blood (the default)
}

export interface ScoredCandidate extends LoincTerm {
  confidence: number // 0..1
}

export interface MappingDecision {
  id: string // biomarker id (keep_id)
  decision: 'approve' | 'override' | 'skip'
  loincCode: string | null
  loincName: string | null
  ucumUnit: string | null
  method: string | null
  displayNameOverride: string | null
}
