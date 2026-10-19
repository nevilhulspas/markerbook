/**
 * Seed script: creates 10 blood tests with ~40 unique markers spread across them.
 * Run with: npx tsx scripts/seed-test-data.ts
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// 10 tests spanning 2 years
const TESTS = [
  { name: 'Annual Physical 2024', test_date: '2024-03-15', sample_type: 'serum' },
  { name: 'Follow-up Q2 2024', test_date: '2024-06-20', sample_type: 'serum' },
  { name: 'Thyroid Check 2024', test_date: '2024-09-10', sample_type: 'plasma' },
  { name: 'Annual Physical 2024 Q4', test_date: '2024-12-05', sample_type: 'serum' },
  { name: 'Lipid Panel Q1 2025', test_date: '2025-02-18', sample_type: 'serum' },
  { name: 'Comprehensive Q2 2025', test_date: '2025-05-22', sample_type: 'serum' },
  { name: 'Vitamin Check 2025', test_date: '2025-08-14', sample_type: 'plasma' },
  { name: 'Annual Physical 2025', test_date: '2025-11-03', sample_type: 'serum' },
  { name: 'Follow-up Q1 2026', test_date: '2026-01-28', sample_type: 'serum' },
  { name: 'Latest Results', test_date: '2026-03-01', sample_type: 'serum' },
] as const

// Marker short_names to use and their approximate realistic values per test
// Each row: [short_name, ...values for test 0-9 (null = not in that test)]
const MARKER_DATA: [string, ...(number | null)[]][] = [
  // Lipids (6) - in most tests
  ['TC',    195, 205, null, 188, 192, 180, null, 175, 178, 172],
  ['LDL',   120, 130, null, 115, 118, 105, null, 100, 98,  95],
  ['HDL',   52,  48,  null, 55,  50,  58,  null, 60,  62,  65],
  ['TG',    140, 155, null, 130, 135, 120, null, 110, 105, 98],
  ['VLDL',  28,  31,  null, 26,  27,  24,  null, 22,  21,  20],
  ['LDL/HDL', 2.3, 2.7, null, 2.1, 2.4, 1.8, null, 1.7, 1.6, 1.5],

  // Metabolic (4) - in comprehensive tests
  ['GLU',   95,  102, null, 92,  null, 88,  null, 85,  null, 84],
  ['A1c',   5.4, 5.7, null, 5.3, null, 5.1, null, 5.0, null, 4.9],
  ['INS',   12,  15,  null, 10,  null, 8,   null, 7,   null, 6.5],
  ['UA',    6.8, 7.1, null, 6.5, null, 6.0, null, 5.5, null, 5.2],

  // Liver (5) - periodic
  ['ALT',   35,  42,  null, 30,  null, 28,  null, 25,  null, 22],
  ['AST',   28,  34,  null, 25,  null, 23,  null, 22,  null, 20],
  ['GGT',   45,  52,  null, 38,  null, 32,  null, 28,  null, 25],
  ['TBIL',  0.8, 0.9, null, 0.7, null, 0.7, null, 0.6, null, 0.6],
  ['ALB',   4.2, 4.0, null, 4.3, null, 4.4, null, 4.5, null, 4.5],

  // Kidney (3) - periodic
  ['CREA',  1.1, 1.2, null, 1.0, null, 1.0, null, 0.9, null, 0.9],
  ['BUN',   18,  20,  null, 16,  null, 14,  null, 13,  null, 12],
  ['eGFR',  85,  82,  null, 90,  null, 95,  null, 98,  null, 100],

  // Thyroid (4) - mainly in thyroid check
  ['TSH',   null, null, 3.8, null, null, 2.5,  null, 2.2, null, 1.8],
  ['FT4',   null, null, 1.1, null, null, 1.25, null, 1.3, null, 1.35],
  ['FT3',   null, null, 2.8, null, null, 3.2,  null, 3.4, null, 3.5],
  ['TT4',   null, null, 7.2, null, null, 8.0,  null, 8.5, null, 9.0],

  // Hematology (6)
  ['WBC',   7.5, null, null, 7.2, null, 6.8, null, 6.5, null, 6.3],
  ['RBC',   4.8, null, null, 4.9, null, 5.0, null, 5.1, null, 5.0],
  ['HGB',   14.5, null, null, 14.8, null, 15.0, null, 15.2, null, 15.0],
  ['HCT',   43, null, null, 44, null, 44.5, null, 45, null, 44.8],
  ['PLT',   220, null, null, 235, null, 245, null, 250, null, 248],
  ['NEUT',  58, null, null, 55, null, 52, null, 50, null, 51],

  // Vitamins (4) - in vitamin checks
  ['25-OH-D', 22, null, null, null, null, 35, 45, 50, null, 55],
  ['B12',     350, null, null, null, null, 420, 500, 550, null, 580],
  ['FOL',     8.5, null, null, null, null, 10, 12, 13, null, 14],
  ['FER',     45, null, null, 60, null, 80, 95, 110, null, 120],

  // Minerals (2)
  ['MG',    1.8, null, null, 1.9, null, 2.0, null, 2.1, null, 2.1],
  ['CA',    9.2, null, null, 9.4, null, 9.5, null, 9.6, null, 9.5],

  // Hormones (2)
  ['T-TOTAL', 450, null, null, null, null, 520, null, 580, null, 600],
  ['CORT',    14, null, null, null, null, 12, null, 11, null, 10],

  // Inflammation (3)
  ['hs-CRP',  2.8, 3.5, null, 2.2, null, 1.5, null, 1.0, null, 0.8],
  ['HCY',     12, null, null, 11, null, 9, null, 8, null, 7],
  ['ESR',     15, null, null, 12, null, 10, null, 8, null, 6],

  // Cardiac (2)
  ['BNP',   45, null, null, null, null, 35, null, 30, null, 25],
  ['Lp(a)', 65, null, null, null, null, 62, null, 60, null, 58],

  // Electrolytes (2)
  ['NA',    140, null, null, 141, null, 140, null, 139, null, 140],
  ['K',     4.2, null, null, 4.0, null, 4.1, null, 4.3, null, 4.2],

  // PhenoAge extras (4) - needed for biological age calculation
  ['MCV',   88, null, null, 89, null, 90, null, 89.5, null, 89],
  ['RDW',   13.2, null, null, 13.5, null, 13.0, null, 12.8, null, 13.1],
  ['ALP',   65, null, null, 60, null, 58, null, 55, null, 52],
  ['LYMPH', 28, null, null, 30, null, 32, null, 31, null, 29],
]

async function main() {
  // Get user ID (first user in the system)
  const { data: users, error: usersErr } = await supabase.auth.admin.listUsers()
  if (usersErr || !users.users.length) {
    console.error('No users found:', usersErr)
    process.exit(1)
  }
  const userId = users.users[0].id
  console.log(`Using user: ${userId} (${users.users[0].email})`)

  // Get biomarkers lookup
  const { data: biomarkers, error: bmErr } = await supabase
    .from('biomarkers')
    .select('id, short_name, unit')
  if (bmErr || !biomarkers) {
    console.error('Failed to fetch biomarkers:', bmErr)
    process.exit(1)
  }
  const bmByShortName = new Map(biomarkers.map(b => [b.short_name, b]))

  // Delete existing test data for this user
  const { error: delErr } = await supabase
    .from('blood_tests')
    .delete()
    .eq('user_id', userId)
  if (delErr) {
    console.error('Failed to delete existing tests:', delErr)
    process.exit(1)
  }
  console.log('Cleared existing test data')

  // Create tests
  const { data: createdTests, error: testErr } = await supabase
    .from('blood_tests')
    .insert(TESTS.map(t => ({ ...t, user_id: userId })))
    .select('id, test_date')
    .order('test_date')
  if (testErr || !createdTests) {
    console.error('Failed to create tests:', testErr)
    process.exit(1)
  }
  console.log(`Created ${createdTests.length} blood tests`)

  // Build marker results
  const results: { blood_test_id: string; biomarker_id: string; value: number; unit: string }[] = []
  let markerCount = 0

  for (const [shortName, ...values] of MARKER_DATA) {
    const bm = bmByShortName.get(shortName)
    if (!bm) {
      console.warn(`Biomarker not found: ${shortName}`)
      continue
    }
    for (let i = 0; i < values.length; i++) {
      const val = values[i]
      if (val != null) {
        results.push({
          blood_test_id: createdTests[i].id,
          biomarker_id: bm.id,
          value: val,
          unit: bm.unit,
        })
        markerCount++
      }
    }
  }

  // Insert all results
  const { error: resErr } = await supabase
    .from('test_results')
    .insert(results)
  if (resErr) {
    console.error('Failed to insert results:', resErr)
    process.exit(1)
  }

  console.log(`Inserted ${markerCount} marker results across ${createdTests.length} tests`)
  console.log(`Unique markers: ${new Set(MARKER_DATA.map(m => m[0])).size}`)

  // Ensure profile has date_of_birth and sex (needed for PhenoAge)
  const { error: profErr } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      date_of_birth: '1989-05-15',
      sex: 'male',
      height_cm: 182,
      weight_kg: 78,
      activity_level: 'moderate',
    })
  if (profErr) {
    console.warn('Failed to update profile:', profErr)
  } else {
    console.log('Profile updated: DOB=1989-05-15, sex=male')
  }
}

main()
