/**
 * NCBI dbSNP + ClinVar enrichment for SNP data.
 * Uses E-utilities (free, rate limited to 3 req/sec without API key).
 * Results cached in clinvar_cache table to avoid re-querying.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'

export interface SnpEnrichment {
  rsid: string
  geneName: string | null
  clinicalSignificance: string | null
}

const NCBI_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const BATCH_SIZE = 50 // dbSNP supports up to 200 IDs per request
const DELAY_MS = 350

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fetch dbSNP summary for a batch of rsIDs.
 */
async function fetchDbSnpBatch(rsids: string[]): Promise<Map<string, SnpEnrichment>> {
  const results = new Map<string, SnpEnrichment>()

  const numericIds = rsids
    .filter((r) => r.startsWith('rs'))
    .map((r) => r.replace('rs', ''))

  if (numericIds.length === 0) return results

  try {
    const url = `${NCBI_BASE}/esummary.fcgi?db=snp&id=${numericIds.join(',')}&retmode=json`
    const res = await fetch(url)
    if (!res.ok) return results

    const data = await res.json()
    const docSums = data?.result ?? {}

    for (const numId of numericIds) {
      const doc = docSums[numId]
      if (!doc || doc.error) continue

      const rsid = `rs${numId}`
      const genes = doc.genes as Array<{ name?: string }> | undefined
      const geneName = genes?.[0]?.name ?? null
      const clinSig = (doc.clinical_significance as string) ?? null

      results.set(rsid, {
        rsid,
        geneName,
        clinicalSignificance: clinSig || null,
      })
    }
  } catch {
    // Non-fatal — skip enrichment on API errors
  }

  return results
}

/**
 * Enrich a list of rsIDs with gene names and clinical significance.
 * Checks clinvar_cache first, fetches missing from NCBI, caches results.
 */
export async function enrichFromClinVar(
  rsids: string[]
): Promise<Map<string, SnpEnrichment>> {
  const allResults = new Map<string, SnpEnrichment>()
  if (rsids.length === 0) return allResults

  // Check cache
  const { data: cached } = await supabaseAdmin
    .from('clinvar_cache')
    .select('rsid, gene_name, clinical_significance')
    .in('rsid', rsids)

  for (const row of cached ?? []) {
    allResults.set(row.rsid, {
      rsid: row.rsid,
      geneName: row.gene_name,
      clinicalSignificance: row.clinical_significance,
    })
  }

  // Find uncached
  const uncached = rsids.filter((r) => !allResults.has(r))
  if (uncached.length === 0) return allResults

  // Fetch in batches from dbSNP
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE)
    const batchResults = await fetchDbSnpBatch(batch)

    for (const [rsid, result] of batchResults) {
      allResults.set(rsid, result)
    }

    // Cache all results (including ones not found, so we don't re-query)
    const toCache = batch.map((rsid) => {
      const r = batchResults.get(rsid)
      return {
        rsid,
        gene_name: r?.geneName ?? null,
        variant_name: null,
        clinical_significance: r?.clinicalSignificance ?? null,
        conditions: null,
        review_status: null,
      }
    })

    if (toCache.length > 0) {
      await supabaseAdmin
        .from('clinvar_cache')
        .upsert(toCache, { onConflict: 'rsid' })
    }

    if (i + BATCH_SIZE < uncached.length) {
      await delay(DELAY_MS)
    }
  }

  return allResults
}
