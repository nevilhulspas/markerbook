// Extraction prompt + JSON schema for microbiome stool reports.
// Designed against Biovis "Mikrobiomanalyse" (German/Dutch), but written
// to generalize to other stool panels (GI-MAP, GenovaGI, BiomeSight).

export const MICROBIOME_EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    test: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        test_date: {
          type: 'string',
          description: 'ISO date YYYY-MM-DD',
        },
        lab_name: { type: ['string', 'null'] },
        sample_type: { type: ['string', 'null'] },
      },
      required: ['name', 'test_date', 'lab_name', 'sample_type'],
    },
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: {
            type: 'string',
            description:
              'Canonical scientific name in English (e.g. "Akkermansia muciniphila", "Bifidobacterium"). Keep "spp." for genus-level group results.',
          },
          rank: {
            type: 'string',
            enum: [
              'kingdom',
              'phylum',
              'class',
              'order',
              'family',
              'genus',
              'species',
              'strain',
              'functional_group',
            ],
          },
          category: {
            type: 'string',
            enum: [
              'beneficial',
              'commensal',
              'opportunistic',
              'pathogenic',
              'unknown',
            ],
            description: 'Use "unknown" if not confident.',
          },
          value: {
            type: ['number', 'null'],
            description:
              'Numeric value. For "< 1,0 x 10^5" use 100000 (the detection limit) and put the original in raw_label. For % use the percent number. For qualitative negative results use 0.',
          },
          unit: {
            type: ['string', 'null'],
            description: '"%", "CFU/g" (convert KVE/g → CFU/g), or "qual".',
          },
          ref_low: { type: ['number', 'null'] },
          ref_high: { type: ['number', 'null'] },
          status: {
            type: 'string',
            enum: ['low', 'normal', 'high', 'unknown'],
            description:
              'Derive from the report: value below ref → low, above → high, within → normal. Use the report colour/arrow cues if present.',
          },
          raw_label: {
            type: ['string', 'null'],
            description:
              'Original printed value/label, e.g. "< 1,0 x 10^5" or "negatief".',
          },
        },
        required: [
          'name',
          'rank',
          'category',
          'value',
          'unit',
          'ref_low',
          'ref_high',
          'status',
          'raw_label',
        ],
      },
    },
    scores: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: {
            type: 'string',
            description:
              'snake_case key. Use these canonical keys when present: shannon_diversity, dysbiosis_index, firmicutes_bacteroidetes_ratio, actinobacteria_proteobacteria_ratio, prevotella_bacteroides_ratio, fecal_ph, secondary_bile_acids, tma_tmao, indoxyl_sulfate, phenols, ammonia, histamine, equol, beta_glucuronidase, fat_content, nitrogen_content, sugar_content, water_content, calprotectin, alpha_1_antitrypsin, secretory_iga, zonulin. Otherwise a sensible snake_case name.',
          },
          value: { type: 'number' },
          unit: { type: ['string', 'null'] },
          ref_low: { type: ['number', 'null'] },
          ref_high: { type: ['number', 'null'] },
          status: {
            type: 'string',
            enum: ['low', 'normal', 'high', 'unknown'],
          },
          description: { type: ['string', 'null'] },
        },
        required: [
          'name',
          'value',
          'unit',
          'ref_low',
          'ref_high',
          'status',
          'description',
        ],
      },
    },
  },
  required: ['test', 'results', 'scores'],
} as const

export function buildMicrobiomeExtractionPrompt(): string {
  return `Extract ALL data from this gut microbiome / stool analysis report into the provided JSON schema. The report may be in German, Dutch, or English.

## Rules

1. **test**: extract the panel name, the sampling/intake date as ISO YYYY-MM-DD (look for "Ingangsdatum", "Eingangsdatum", "Probenentnahme", "collection date"), the lab name, and sample type (usually "stool").

2. **results** — every named organism, phylum, genus, species, family, or functional group:
   - Translate names to canonical English scientific names. Keep "spp." for genus-group rows. Keep functional-group names readable (e.g. "Butyrate-producing bacteria (total)", "Sulfate-reducing bacteria (SRB)").
   - rank: one of kingdom/phylum/class/order/family/genus/species/strain/functional_group.
   - For phylum-distribution rows, unit = "%" and value = the percentage.
   - For absolute counts in "KVE/g" or "CFU/g", set unit = "CFU/g" and value = the number (e.g. "9,4 x 10^10" → 94000000000). Convert European decimal commas.
   - For below-detection "< 1,0 x 10^5", set value to the detection limit (100000), unit "CFU/g", and put "< 1,0 x 10^5" in raw_label.
   - For qualitative results (parasites: "negatief"/"positief"), unit = "qual", value = 0 for negative / 1 for positive, raw_label = the printed word.
   - ref_low / ref_high: parse the norm range. "> X" → ref_low = X, ref_high = null. "< X" → ref_low = null, ref_high = X. "A - B" → ref_low = A, ref_high = B.
   - status: low if below the range, high if above, normal if within, unknown if no reference. Use the report's red/bold highlighting and arrow icons as corroboration.
   - category: classify the organism (beneficial / commensal / opportunistic / pathogenic) if confident, else "unknown".

3. **scores** — everything that is NOT a single organism count: diversity index, dysbiosis index, all ratios, the metabolome (% deviation) markers, fecal pH, stool consistency-derived numbers, digestion values (fat/nitrogen/sugar/water content), and gut-barrier markers (calprotectin, alpha-1-antitrypsin, secretory IgA, zonulin). Use the canonical snake_case keys listed in the schema where they apply.

4. Be exhaustive. Do not skip rows. If a value is unreadable, set value to null and status to "unknown" rather than guessing.

Return ONLY the JSON object.`
}
