import { describe, it, expect } from 'vitest'

import { buildTrend } from '../trend'
import type { DexaScan, BodyLogEntry } from '@/lib/database.types'

const scan = (over: Partial<DexaScan>): DexaScan => ({
  id: 's', user_id: 'u', scan_date: '2026-01-01', provider: null,
  age_years: null, height_cm: null, weight_kg: null, total_mass_kg: null,
  fat_mass_g: null, lean_mass_g: null, bmc_g: null, body_fat_pct: null,
  visceral_fat_g: null, android_fat_pct: null, gynoid_fat_pct: null,
  android_gynoid_ratio: null, almi: null, ffmi: null, bone_t_score: null,
  bone_z_score: null, total_bmd: null, source: 'summary', notes: null,
  pdf_storage_path: null, created_at: '', updated_at: '', ...over,
})

const log = (over: Partial<BodyLogEntry>): BodyLogEntry => ({
  id: 'l', user_id: 'u', logged_on: '2026-02-01', weight_kg: null,
  body_fat_pct: null, waist_cm: null, notes: null, created_at: '', ...over,
})

describe('buildTrend', () => {
  it('body_fat_pct: separate DEXA + scale series, merged + sorted by date', () => {
    const r = buildTrend(
      'body_fat_pct',
      [scan({ scan_date: '2026-01-01', body_fat_pct: 26 })],
      [log({ logged_on: '2026-02-01', body_fat_pct: 24 }), log({ logged_on: '2026-01-15', body_fat_pct: 25 })]
    )
    expect(r.series.map((s) => s.key).sort()).toEqual(['dexa', 'scale'])
    expect(r.data.map((d) => d.date)).toEqual(['2026-01-01', '2026-01-15', '2026-02-01'])
    expect(r.data[0].dexa).toBe(26)
    expect(r.data[2].scale).toBe(24)
  })

  it('waist: a single log-only series', () => {
    const r = buildTrend('waist', [], [log({ waist_cm: 84 })])
    expect(r.series).toHaveLength(1)
    expect(r.series[0].key).toBe('log')
  })

  it('drops a series that has no data points', () => {
    const r = buildTrend('body_fat_pct', [scan({ body_fat_pct: 26 })], [])
    expect(r.series.map((s) => s.key)).toEqual(['dexa']) // scale series dropped
  })

  it('is empty when there is no data for the metric', () => {
    expect(buildTrend('ffmi', [], []).series).toEqual([])
    expect(buildTrend('ffmi', [], []).data).toEqual([])
  })
})
