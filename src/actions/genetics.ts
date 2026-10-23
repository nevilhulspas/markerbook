'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/supabase/session'
import { userErrorMessage } from '@/lib/supabase/errors'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { GeneticProfile, SnpVariant } from '@/lib/database.types'
import { parseRawGeneticsFile, parseXlsxGeneticsFile } from '@/lib/genetics/parse-raw'
import { HEALTH_SNP_MAP } from '@/lib/genetics/health-snps'
import { enrichFromClinVar } from '@/lib/genetics/clinvar'

export async function getGeneticProfile(): Promise<
  { data: GeneticProfile | null; error: null } | { data: null; error: string }
> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) return { data: null, error: authError ?? 'Not authenticated' }

  const { data, error } = await supabase
    .from('genetic_profiles')
    .select('*')
    .order('import_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return {
      data: null,
      error: userErrorMessage(
        'getGeneticProfile',
        error,
        'Could not load your genetic profile. Please try again.'
      ),
    }
  }
  return { data: data as GeneticProfile | null, error: null }
}

export async function getHealthRelevantSnps(): Promise<
  { data: SnpVariant[]; error: null } | { data: null; error: string }
> {
  const { supabase, user, authError } = await getSessionUser()

  if (!user) return { data: null, error: authError ?? 'Not authenticated' }

  // Get the user's latest genetic profile
  const { data: profile } = await supabase
    .from('genetic_profiles')
    .select('id')
    .order('import_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!profile) return { data: [], error: null }

  // Get SNPs that have gene_name populated (enriched health-relevant ones)
  const { data, error } = await supabaseAdmin
    .from('snp_variants')
    .select('*')
    .eq('genetic_profile_id', profile.id)
    .not('gene_name', 'is', null)
    .order('category')

  if (error) {
    return {
      data: null,
      error: userErrorMessage(
        'getHealthRelevantSnps',
        error,
        'Could not load your genetic variants. Please try again.'
      ),
    }
  }
  return { data: (data ?? []) as SnpVariant[], error: null }
}

export async function importRawGenetics(
  formData: FormData
): Promise<{
  success: boolean
  profileId?: string
  snpCount?: number
  healthSnpCount?: number
  source?: string | null
  error?: string
}> {
  const { user, authError } = await getSessionUser()

  if (!user) return { success: false, error: authError ?? 'Not authenticated' }

  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: 'No file provided' }

  // Parse based on file type
  const isXlsx = file.name.endsWith('.xlsx') || file.type.includes('spreadsheet')
  const arrayBuffer = await file.arrayBuffer()

  const result = isXlsx
    ? await parseXlsxGeneticsFile(arrayBuffer)
    : parseRawGeneticsFile(new TextDecoder().decode(arrayBuffer))

  if (result.errors.length > 0) {
    return { success: false, error: result.errors.join('; ') }
  }

  if (result.snps.length === 0) {
    return { success: false, error: 'No SNP data found in file' }
  }

  // Upload original file to storage
  // The extension comes from the user's file name: keep it to the characters
  // a storage path may hold (see isOwnedPath).
  const ext = (file.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'txt'
  const storagePath = `${user.id}/genetics/${crypto.randomUUID()}.${ext}`
  await supabaseAdmin.storage
    .from('lab-pdfs')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || 'text/plain',
      upsert: false,
    })

  // Create genetic profile
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('genetic_profiles')
    .insert({
      user_id: user.id,
      source: result.source,
      file_storage_path: storagePath,
      snp_count: result.snps.length,
    })
    .select()
    .single()

  if (profileError || !profile) {
    return { success: false, error: profileError?.message ?? 'Failed to create profile' }
  }

  // Enrich SNPs: first from our static catalog, then from ClinVar API
  const allRsids = result.snps
    .filter((s) => s.rsid.startsWith('rs'))
    .map((s) => s.rsid)
  const clinvarData = await enrichFromClinVar(allRsids)

  const snpRows = result.snps.map((snp) => {
    const healthInfo = HEALTH_SNP_MAP.get(snp.rsid)
    const clinvar = clinvarData.get(snp.rsid)
    return {
      genetic_profile_id: profile.id,
      rsid: snp.rsid,
      chromosome: snp.chromosome || null,
      position: snp.position,
      genotype: snp.genotype,
      gene_name: healthInfo?.gene ?? clinvar?.geneName ?? snp.geneName ?? null,
      variant_name: healthInfo?.variant ?? null,
      clinical_significance: clinvar?.clinicalSignificance ?? null,
      category: healthInfo?.category ?? null,
    }
  })

  // Batch insert (Supabase has limits, chunk to 1000)
  const BATCH_SIZE = 1000
  let healthSnpCount = 0

  for (let i = 0; i < snpRows.length; i += BATCH_SIZE) {
    const batch = snpRows.slice(i, i + BATCH_SIZE)
    const { error: insertError } = await supabaseAdmin
      .from('snp_variants')
      .insert(batch)

    if (insertError) {
      // Clean up on failure
      await supabaseAdmin.from('genetic_profiles').delete().eq('id', profile.id)
      return {
        success: false,
        error: userErrorMessage(
          '[importGenetics] insert snp_variants',
          insertError,
          'Could not save your genetic data. Please try again.'
        ),
      }
    }

    healthSnpCount += batch.filter((s) => s.gene_name !== null).length
  }

  revalidatePath('/genetics')
  revalidatePath('/insights')

  return {
    success: true,
    profileId: profile.id,
    snpCount: result.snps.length,
    healthSnpCount,
    source: result.source,
  }
}
