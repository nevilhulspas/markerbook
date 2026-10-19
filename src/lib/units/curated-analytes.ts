/**
 * Molar masses that must NOT come from a ChEBI / PubChem lookup, keyed by the
 * LOINC "analyte-core" part name. These are the reporting conventions labs use
 * (a looked-up mass would give a different, wrong factor), proteins that the
 * chemistry databases have no single mass for, and ions that need a valence for
 * mEq ↔ mmol. `null` marks a substance that must stay unconverted.
 *
 * Used by scripts/units/build-molar-masses.ts; each entry names its basis.
 */
export interface CuratedAnalyte {
  /** Molar mass in g/mol used by labs for this substance. */
  molarMass: number
  /** Charge number, for mEq/L ↔ mmol/L. */
  valence?: number
  basis: string
}

export const CURATED_ANALYTES: Record<string, CuratedAnalyte | null> = {
  // Reporting conventions
  Triglyceride: { molarMass: 885.7, basis: 'as triolein (1 mmol/L = 88.57 mg/dL)' },
  'Cholesterol.total': { molarMass: 386.65, basis: 'cholesterol (1 mmol/L = 38.67 mg/dL)' },
  Cholesterol: { molarMass: 386.65, basis: 'cholesterol (1 mmol/L = 38.67 mg/dL)' },
  'Cholesterol.in HDL': { molarMass: 386.65, basis: 'cholesterol (1 mmol/L = 38.67 mg/dL)' },
  'Cholesterol.in LDL': { molarMass: 386.65, basis: 'cholesterol (1 mmol/L = 38.67 mg/dL)' },
  'Cholesterol.non HDL': { molarMass: 386.65, basis: 'cholesterol (1 mmol/L = 38.67 mg/dL)' },
  'Cholesterol.in VLDL': { molarMass: 386.65, basis: 'cholesterol (1 mmol/L = 38.67 mg/dL)' },
  'Calcidiol+ercalcidiol': { molarMass: 400.64, basis: 'total 25-OH vitamin D as D3 (1 ng/mL = 2.496 nmol/L)' },
  'Calcidiol+Calciferol': { molarMass: 400.64, basis: 'total 25-OH vitamin D as D3 (1 ng/mL = 2.496 nmol/L)' },
  'Bilirubin.glucuronidated': { molarMass: 584.66, basis: 'as bilirubin (1 mg/dL = 17.1 umol/L)' },
  'Bilirubin.glucuronidated+Bilirubin.albumin bound': { molarMass: 584.66, basis: 'direct bilirubin as bilirubin (1 mg/dL = 17.1 umol/L)' },
  'Iron binding capacity': { molarMass: 55.845, basis: 'as iron (1 umol/L = 5.585 ug/dL)' },
  'Iron binding capacity.unsaturated': { molarMass: 55.845, basis: 'as iron (1 umol/L = 5.585 ug/dL)' },
  'Testosterone.free+weakly bound': { molarMass: 288.42, basis: 'as testosterone' },
  Phosphate: { molarMass: 30.974, basis: 'reported as phosphorus (1 mmol/L = 3.10 mg/dL)' },
  'Urea nitrogen': { molarMass: 28.014, basis: 'urea N2 (1 mmol/L urea = 2.80 mg/dL BUN)' },
  Cobalamins: { molarMass: 1355.38, basis: 'as cyanocobalamin (1 pg/mL = 0.738 pmol/L)' },
  Hemoglobin: { molarMass: 16114.5, basis: 'per haem monomer, IFCC/NL convention (1 mmol/L = 1.611 g/dL)' },
  // HbA1c % ↔ mmol/mol is the IFCC–NGSP equation, not a molar mass.
  'Hemoglobin A1c': null,

  // Proteins and peptides
  Albumin: { molarMass: 66470, basis: 'human serum albumin, 66.47 kDa' },
  Insulin: { molarMass: 5808, basis: 'human insulin, 5.808 kDa' },
  'C peptide': { molarMass: 3020.3, basis: 'human C-peptide, 3.020 kDa' },
  'Parathyrin.intact': { molarMass: 9425, basis: 'PTH(1-84), 9.425 kDa' },
  Parathyrin: { molarMass: 9425, basis: 'PTH(1-84), 9.425 kDa' },
  Ferritin: { molarMass: 445000, basis: 'lab convention 1 ng/mL = 2.247 pmol/L' },
  'Insulin-like growth factor-I': { molarMass: 7649, basis: 'IGF-1, 7.649 kDa (1 ng/mL = 0.131 nmol/L)' },
  'Natriuretic peptide.B prohormone N-Terminal': { molarMass: 8457, basis: 'NT-proBNP, 8.457 kDa (1 pg/mL = 0.118 pmol/L)' },
  'Natriuretic peptide.B': { molarMass: 3464, basis: 'BNP-32, 3.464 kDa (1 pg/mL = 0.289 pmol/L)' },
  Transferrin: { molarMass: 79570, basis: 'human transferrin, 79.57 kDa (1 g/L = 12.57 umol/L)' },
  'Beta-2-Microglobulin': { molarMass: 11800, basis: 'beta-2-microglobulin, 11.8 kDa' },

  // Elements LOINC links to no ChEBI entry with a mass
  Cadmium: { molarMass: 112.41, basis: 'Cd' },

  // Ions: valence for mEq/L
  Sodium: { molarMass: 22.99, valence: 1, basis: 'Na+' },
  Potassium: { molarMass: 39.098, valence: 1, basis: 'K+' },
  Chloride: { molarMass: 35.453, valence: 1, basis: 'Cl-' },
  Bicarbonate: { molarMass: 61.017, valence: 1, basis: 'HCO3-' },
  Lithium: { molarMass: 6.94, valence: 1, basis: 'Li+' },
  Calcium: { molarMass: 40.078, valence: 2, basis: 'Ca2+ (1 mmol/L = 4.008 mg/dL = 2 mEq/L)' },
  Magnesium: { molarMass: 24.305, valence: 2, basis: 'Mg2+ (1 mmol/L = 2.431 mg/dL = 2 mEq/L)' },
}
