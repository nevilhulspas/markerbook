'use client'

import { useMemo, useState } from 'react'
import {
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'

import { buildTrend, type TrendMetric } from '@/lib/body/trend'
import { Button } from '@/components/ui/button'
import type { DexaScan, BodyLogEntry } from '@/lib/database.types'

const METRICS: { key: TrendMetric; label: string }[] = [
  { key: 'body_fat_pct', label: 'Body fat %' },
  { key: 'weight', label: 'Weight' },
  { key: 'waist', label: 'Waist' },
  { key: 'lean_kg', label: 'Lean' },
  { key: 'ffmi', label: 'FFMI' },
  { key: 'visceral_fat_g', label: 'Visceral fat' },
]

/**
 * Trend of a chosen metric over time. DEXA scans and manual/scale log entries
 * are drawn as separate series (see buildTrend). Only metrics with data get a
 * toggle.
 */
export function BodyTrendChart({
  scans,
  logEntries,
}: {
  scans: DexaScan[]
  logEntries: BodyLogEntry[]
}) {
  const available = useMemo(
    () => METRICS.filter((m) => buildTrend(m.key, scans, logEntries).series.length > 0),
    [scans, logEntries]
  )
  const [selected, setSelected] = useState<TrendMetric>(available[0]?.key ?? 'body_fat_pct')
  const metric = available.some((m) => m.key === selected) ? selected : available[0]?.key

  const { series, data } = useMemo(
    () => (metric ? buildTrend(metric, scans, logEntries) : { series: [], data: [] }),
    [metric, scans, logEntries]
  )

  if (available.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {available.map((m) => (
          <Button
            key={m.key}
            size="sm"
            variant={m.key === metric ? 'default' : 'outline'}
            onClick={() => setSelected(m.key)}
          >
            {m.label}
          </Button>
        ))}
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
                boxShadow: '0 4px 12px rgb(0 0 0 / 0.3)',
              }}
              labelStyle={{ color: 'var(--foreground)', fontWeight: 600, marginBottom: 2 }}
              itemStyle={{ color: 'var(--foreground)' }}
            />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
