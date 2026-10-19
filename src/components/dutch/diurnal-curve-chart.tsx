'use client'

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { DiurnalPoint } from '@/lib/dutch/diurnal-data'
import { Badge } from '@/components/ui/badge'

const CORTISOL_COLOR = '#f97316' // orange-500
const CORTISONE_COLOR = '#fbbf24' // amber-400

const chartConfig = {
  cortisol: { label: 'Free Cortisol', color: CORTISOL_COLOR },
  cortisone: { label: 'Free Cortisone', color: CORTISONE_COLOR },
  refCortisolLow: { label: 'Ref Low', color: 'hsl(142 76% 36%)' },
  refBand: { label: 'Reference Range', color: 'hsl(142 76% 36%)' },
} satisfies ChartConfig

interface DiurnalCurveChartProps {
  data: DiurnalPoint[]
  car: number | null
}

export function DiurnalCurveChart({ data, car }: DiurnalCurveChartProps) {
  // Check if we have enough cortisol data points
  const cortisolPoints = data.filter((d) => d.cortisol !== null)
  if (cortisolPoints.length < 2) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Not enough diurnal data to display curve
      </div>
    )
  }

  // Add computed refBand field (high - low) for stacked area technique
  const chartData = data.map((point) => ({
    ...point,
    refBand: point.refCortisolHigh - point.refCortisolLow,
  }))

  return (
    <div className="space-y-3">
      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <ComposedChart
          data={chartData}
          margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 'auto']}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={32}
          />

          {/* Reference band using stacked area technique */}
          <Area
            dataKey="refCortisolLow"
            stackId="ref"
            fill="transparent"
            stroke="none"
            type="monotone"
            isAnimationActive={false}
          />
          <Area
            dataKey="refBand"
            stackId="ref"
            fill="hsl(142 76% 36%)"
            fillOpacity={0.12}
            stroke="none"
            type="monotone"
            isAnimationActive={false}
          />

          {/* Cortisol line (solid) */}
          <Line
            dataKey="cortisol"
            stroke={CORTISOL_COLOR}
            strokeWidth={2}
            dot={{ r: 4, fill: CORTISOL_COLOR, stroke: CORTISOL_COLOR }}
            activeDot={{ r: 6 }}
            connectNulls
            type="monotone"
          />

          {/* Cortisone line (dashed) */}
          <Line
            dataKey="cortisone"
            stroke={CORTISONE_COLOR}
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ r: 4, fill: CORTISONE_COLOR, stroke: CORTISONE_COLOR }}
            activeDot={{ r: 6 }}
            connectNulls
            type="monotone"
          />

          <ChartTooltip content={<ChartTooltipContent />} />
        </ComposedChart>
      </ChartContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-1.5">
          <div
            className="h-0.5 w-4"
            style={{ backgroundColor: CORTISOL_COLOR }}
          />
          <span className="text-muted-foreground">Free Cortisol</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="h-0.5 w-4 border-t-2 border-dashed"
            style={{ borderColor: CORTISONE_COLOR }}
          />
          <span className="text-muted-foreground">Free Cortisone</span>
        </div>
      </div>

      {/* CAR display */}
      {car !== null && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono tabular-nums">
            CAR: {car.toFixed(1)}%
          </Badge>
          <span className="text-xs text-muted-foreground">
            Cortisol Awakening Response
          </span>
        </div>
      )}
    </div>
  )
}
