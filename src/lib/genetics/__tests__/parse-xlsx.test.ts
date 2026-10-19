import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import { parseXlsxGeneticsFile } from '@/lib/genetics/parse-raw'

// The fixtures were written with SheetJS (`xlsx`), the parser this module used
// before OTH-49, and the expectations below are that parser's exact output.
// They pin the behaviour so the library swap cannot change what gets imported.
function fixture(name: string): ArrayBuffer {
  const bytes = fs.readFileSync(path.join(__dirname, 'fixtures', name))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

describe('parseXlsxGeneticsFile', () => {
  it('reads a lab gene panel from the first sheet', async () => {
    expect(await parseXlsxGeneticsFile(fixture('panel.xlsx'))).toEqual({
      snps: [
        { rsid: 'rs1801133', chromosome: '', position: null, genotype: 'CT', geneName: 'MTHFR' },
        // Upper-case and padded rsids are normalised.
        { rsid: 'rs1801131', chromosome: '', position: null, genotype: 'AA', geneName: 'MTHFR' },
        { rsid: 'rs4680', chromosome: '', position: null, genotype: 'GG', geneName: 'COMT' },
        // Numeric 0 and a bare line break mean "not tested" and are skipped (VDR, APOE).
        // An empty gene cell gives no gene name.
        { rsid: 'rs7412', chromosome: '', position: null, genotype: 'CC' },
        { rsid: 'rs9939609', chromosome: '', position: null, genotype: 'AT', geneName: 'FTO' },
      ],
      source: 'Clinical lab',
      errors: [],
    })
  })

  it('keeps a blank allele row, skips non-rsid columns and "0" genotypes', async () => {
    expect(await parseXlsxGeneticsFile(fixture('gaps.xlsx'))).toEqual({
      snps: [
        // A whitespace-only gene cell becomes an empty gene name (not undefined).
        { rsid: 'rs1065852', chromosome: '', position: null, genotype: 'AG', geneName: '' },
        // Numeric genotypes are stringified.
        { rsid: 'rs2069514', chromosome: '', position: null, genotype: '12', geneName: 'CYP1A2' },
      ],
      source: 'Clinical lab',
      errors: [],
    })
  })

  it('rejects a sheet with fewer than 4 rows', async () => {
    expect(await parseXlsxGeneticsFile(fixture('too-short.xlsx'))).toEqual({
      snps: [],
      source: 'Clinical lab',
      errors: ['XLSX file has fewer than 4 rows — expected gene panel format'],
    })
  })

  it('reports when no rsid columns are found', async () => {
    expect(await parseXlsxGeneticsFile(fixture('no-snps.xlsx'))).toEqual({
      snps: [],
      source: 'Clinical lab',
      errors: ['No SNP data found in XLSX file.'],
    })
  })
})
