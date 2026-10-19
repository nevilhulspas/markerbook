import { readSheet } from 'read-excel-file/node'

/**
 * OOXML stores control characters in cell text as `_xHHHH_` (e.g. a carriage
 * return is `_x000D_`). SheetJS decoded these; read-excel-file does not, and lab
 * panels use a bare line break as the "not tested" marker, so decode them here.
 */
function decodeOoxmlEscapes(text: string): string {
  return text.replace(/_x([0-9a-fA-F]{4})_/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  )
}

/**
 * Parse an XLSX gene panel file (clinical lab format).
 * Layout: rows are transposed — gene names in row 0, rsIDs in row 1,
 * allele options in row 2, patient genotypes in row 3+.
 * Columns represent individual SNPs.
 */
export async function parseXlsxGeneticsFile(buffer: ArrayBuffer): Promise<ParseResult> {
  // First sheet only. `trim: false` keeps cell strings raw, as the old SheetJS
  // parser did; the checks below do their own trimming.
  const rows = (await readSheet(Buffer.from(buffer), { trim: false })).map((row) =>
    row.map((cell) => (typeof cell === 'string' ? decodeOoxmlEscapes(cell) : cell))
  )

  if (rows.length < 4) {
    return { snps: [], source: 'Clinical lab', errors: ['XLSX file has fewer than 4 rows — expected gene panel format'] }
  }

  const geneRow = rows[0] as (string | null)[]
  const rsidRow = rows[1] as (string | null)[]
  const genotypeRow = rows[3] as (string | number | null)[]

  const snps: ParsedSnp[] = []
  const errors: string[] = []

  for (let col = 0; col < rsidRow.length; col++) {
    const rawRsid = rsidRow[col]
    if (!rawRsid || typeof rawRsid !== 'string') continue

    const rsid = rawRsid.trim().toLowerCase().replace(/^rs/, 'rs')
    if (!rsid.startsWith('rs')) continue

    const genotype = genotypeRow[col]
    if (genotype === null || genotype === undefined || genotype === 0 || genotype === '\r\n') continue
    const genotypeStr = String(genotype).trim()
    if (!genotypeStr || genotypeStr === '0') continue

    const geneName = geneRow[col] ? String(geneRow[col]).trim() : null

    snps.push({
      rsid,
      chromosome: '',
      position: null,
      genotype: genotypeStr,
      geneName: geneName ?? undefined,
    })
  }

  if (snps.length === 0) {
    errors.push('No SNP data found in XLSX file.')
  }

  return { snps, source: 'Clinical lab', errors }
}

/**
 * Parse 23andMe / AncestryDNA raw genotype files.
 *
 * 23andMe format (tab-separated):
 *   # rsid  chromosome  position  genotype
 *   rs4477212  1  82154  AA
 *
 * AncestryDNA format (tab-separated, with header row):
 *   rsid  chromosome  position  allele1  allele2
 *   rs4477212  1  82154  A  A
 *
 * Lines starting with '#' are comments and skipped.
 */

export interface ParsedSnp {
  rsid: string
  chromosome: string
  position: number | null
  genotype: string
  geneName?: string // from XLSX panel format
}

export interface ParseResult {
  snps: ParsedSnp[]
  source: string | null // detected source: '23andMe', 'AncestryDNA', or null
  errors: string[]
}

export function parseRawGeneticsFile(text: string): ParseResult {
  const lines = text.split(/\r?\n/)
  const snps: ParsedSnp[] = []
  const errors: string[] = []
  let source: string | null = null

  // Detect source from comments
  for (const line of lines) {
    if (!line.startsWith('#')) break
    if (line.includes('23andMe')) source = '23andMe'
    else if (line.includes('AncestryDNA') || line.includes('Ancestry')) source = 'AncestryDNA'
  }

  let isAncestryFormat = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue

    // Detect AncestryDNA header
    if (trimmed.startsWith('rsid') && trimmed.includes('allele1')) {
      isAncestryFormat = true
      source = source ?? 'AncestryDNA'
      continue
    }

    // Skip any header-like line
    if (trimmed.startsWith('rsid')) continue

    const parts = trimmed.split('\t')

    if (isAncestryFormat && parts.length >= 5) {
      // AncestryDNA: rsid, chromosome, position, allele1, allele2
      const [rsid, chromosome, posStr, allele1, allele2] = parts
      if (!rsid.startsWith('rs') && !rsid.startsWith('i')) continue

      const position = parseInt(posStr, 10)
      snps.push({
        rsid: rsid.trim(),
        chromosome: chromosome.trim(),
        position: isNaN(position) ? null : position,
        genotype: `${allele1.trim()}${allele2.trim()}`,
      })
    } else if (parts.length >= 4) {
      // 23andMe: rsid, chromosome, position, genotype
      const [rsid, chromosome, posStr, genotype] = parts
      if (!rsid.startsWith('rs') && !rsid.startsWith('i')) continue

      const position = parseInt(posStr, 10)
      snps.push({
        rsid: rsid.trim(),
        chromosome: chromosome.trim(),
        position: isNaN(position) ? null : position,
        genotype: genotype.trim(),
      })
    } else if (parts.length >= 2) {
      // Minimal format: rsid, genotype (some exports)
      const [rsid, genotype] = parts
      if (!rsid.startsWith('rs')) continue
      snps.push({
        rsid: rsid.trim(),
        chromosome: '',
        position: null,
        genotype: genotype.trim(),
      })
    }
  }

  if (snps.length === 0) {
    errors.push('No SNP data found in file. Expected 23andMe or AncestryDNA raw data format.')
  }

  return { snps, source, errors }
}
