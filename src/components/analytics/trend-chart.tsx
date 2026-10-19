'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceArea,
  CartesianGrid,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { TrendData } from '@/lib/analytics/marker-trends'

const chartConfig = {
  value: { label: 'Value', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig

function formatDateLabel(dateStr: string): string {
  const [year, month] = dateStr.split('-')
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]
  return `${months[parseInt(month, 10) - 1]} ${year}`
}

interface TrendChartProps {
  data: TrendData
}

export function TrendChart({ data }: TrendChartProps) {
  if (data.points.length < 2) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Need at least 2 tests to show trends
      </div>
    )
  }

  // Y-axis: start at 0, let Recharts pick nice upper bound
  // Ensure reference range is visible by including it in the data range

  return (
    <div className="min-w-0 space-y-1.5">
      <div>
        <p className="text-sm font-medium">{data.markerName}</p>
        <p className="text-xs text-muted-foreground">{data.unit}</p>
      </div>
      <ChartContainer config={chartConfig} className="h-[200px] w-full min-w-0">
        <LineChart
          data={data.points}
          margin={{ top: 8, right: 12, bottom: 4, left: 12 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 'auto']}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={45}
          />
          {data.refLow != null && data.refHigh != null && (
            <ReferenceArea
              y1={data.refLow}
              y2={data.refHigh}
              fill="hsl(142 76% 36%)"
              fillOpacity={0.12}
              ifOverflow="extendDomain"
            />
          )}
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, _name, item) => (
                  <span className="font-mono tabular-nums">
                    {typeof value === 'number' ? value.toFixed(2) : value}{' '}
                    <span className="text-muted-foreground">{data.unit}</span>
                    {item?.payload?.testName && (
                      <span className="ml-1 text-muted-foreground">
                        ({item.payload.testName})
                      </span>
                    )}
                  </span>
                )}
              />
            }
          />
          <Line
            dataKey="value"
            stroke="var(--foreground)"
            strokeWidth={1}
            strokeOpacity={0.2}
            strokeDasharray="3 3"
            dot={{ r: 4, fill: 'var(--foreground)', stroke: 'var(--foreground)' }}
            activeDot={{ r: 6, fill: 'var(--foreground)', stroke: 'var(--foreground)' }}
            connectNulls={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  )
}
