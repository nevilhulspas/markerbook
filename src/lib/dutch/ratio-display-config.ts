export interface RatioDisplayConfig {
  label: string
  min: number
  max: number
  refLow?: number
  refHigh?: number
  leftLabel: string
  rightLabel: string
  unit: string
  precision: number
  category: 'estrogen' | 'androgen' | 'progesterone' | 'cortisol'
}

/**
 * Display configuration for all 10 DUTCH computed ratios.
 * Keys match the `name` field of DUTCH_RATIOS in computed-ratios.ts.
 */
export const RATIO_DISPLAY_CONFIG: Record<string, RatioDisplayConfig> = {
  '24h_free_cortisol': {
    label: '24h Free Cortisol',
    min: 0,
    max: 250,
    refLow: 30,
    refHigh: 170,
    leftLabel: 'Low',
    rightLabel: 'High',
    unit: 'ng/mg',
    precision: 1,
    category: 'cortisol',
  },
  '24h_free_cortisone': {
    label: '24h Free Cortisone',
    min: 0,
    max: 250,
    refLow: 30,
    refHigh: 170,
    leftLabel: 'Low',
    rightLabel: 'High',
    unit: 'ng/mg',
    precision: 1,
    category: 'cortisol',
  },
  metabolized_cortisol: {
    label: 'Metabolized Cortisol',
    min: 0,
    max: 15000,
    refLow: 2000,
    refHigh: 9000,
    leftLabel: 'Low',
    rightLabel: 'High',
    unit: 'ug/g',
    precision: 0,
    category: 'cortisol',
  },
  cortisol_clearance_rate: {
    label: 'Cortisol Clearance',
    min: 0,
    max: 150,
    refLow: 20,
    refHigh: 80,
    leftLabel: 'Low clearance',
    rightLabel: 'High clearance',
    unit: 'ratio',
    precision: 1,
    category: 'cortisol',
  },
  cortisol_cortisone_ratio: {
    label: 'Cortisol/Cortisone',
    min: 0,
    max: 3,
    refLow: 0.5,
    refHigh: 1.5,
    leftLabel: 'Cortisone dominant',
    rightLabel: 'Cortisol dominant',
    unit: 'ratio',
    precision: 2,
    category: 'cortisol',
  },
  '2oh_4oh_e1_ratio': {
    label: '2-OH/4-OH Ratio',
    min: 0,
    max: 20,
    refLow: 2,
    refHigh: 10,
    leftLabel: '4-OH preference',
    rightLabel: '2-OH preference',
    unit: 'ratio',
    precision: 1,
    category: 'estrogen',
  },
  '2oh_16oh_e1_ratio': {
    label: '2-OH/16-OH Ratio',
    min: 0,
    max: 10,
    refLow: 1,
    refHigh: 4,
    leftLabel: '16-OH preference',
    rightLabel: '2-OH preference',
    unit: 'ratio',
    precision: 1,
    category: 'estrogen',
  },
  methylation_activity: {
    label: 'Methylation Activity',
    min: 0,
    max: 1,
    refLow: 0.15,
    refHigh: 0.6,
    leftLabel: 'Low methylation',
    rightLabel: 'High methylation',
    unit: 'ratio',
    precision: 2,
    category: 'estrogen',
  },
  '5a_reductase_preference': {
    label: '5a-Reductase',
    min: 0,
    max: 5,
    refLow: 0.5,
    refHigh: 2.5,
    leftLabel: '5b preference',
    rightLabel: '5a preference',
    unit: 'ratio',
    precision: 2,
    category: 'androgen',
  },
  progesterone_5a_preference: {
    label: 'Progesterone 5a',
    min: 0,
    max: 1,
    refLow: 0.2,
    refHigh: 0.6,
    leftLabel: 'b-Pregnanediol',
    rightLabel: 'a-Pregnanediol',
    unit: 'ratio',
    precision: 2,
    category: 'progesterone',
  },
}
