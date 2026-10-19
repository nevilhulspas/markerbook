'use client'

import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { RmrTest } from '@/lib/database.types'
import { APP_LOCALE } from '@/lib/locale'

/**
 * Measured RMR (kcal/day) over time. Tests arrive newest-first; we reverse to
 * draw oldest → newest left-to-right. Single series, so no legend/toggle.
 */
export function RmrTrendChart({ tests }: { tests: RmrTest[] }) {
  const data = useMemo(
    () =>
      [...tests]
        .sort((a, b) => a.test_date.localeCompare(b.test_date))
        .map((t) => ({
          label: new Date(t.test_date).toLocaleDateString(APP_LOCALE, {
            month: 'short',
            day: 'numeric',
          }),
          rmr_kcal: Math.round(t.rmr_kcal),
        })),
    [tests]
  )

  if (data.length === 0) return null

  return (
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
          <Line
            type="monotone"
            dataKey="rmr_kcal"
            name="RMR (kcal/day)"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
