export interface RatioSliderProps {
  value: number
  min: number
  max: number
  refLow?: number
  refHigh?: number
  leftLabel: string
  rightLabel: string
  name: string
  unit: string
  precision?: number
}

export function RatioSlider({
  value,
  min,
  max,
  refLow,
  refHigh,
  leftLabel,
  rightLabel,
  name,
  unit,
  precision = 2,
}: RatioSliderProps) {
  const range = max - min
  const clampedValue = Math.max(min, Math.min(max, value))
  const valuePercent = range > 0 ? ((clampedValue - min) / range) * 100 : 0

  const hasRefZone = refLow != null && refHigh != null
  const refLeftPercent =
    hasRefZone && range > 0 ? ((refLow - min) / range) * 100 : 0
  const refWidthPercent =
    hasRefZone && range > 0 ? ((refHigh - refLow) / range) * 100 : 0

  return (
    <div className="space-y-1.5">
      {/* Header: name + formatted value */}
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{name}</span>
        <span className="text-sm font-mono tabular-nums text-muted-foreground">
          {value.toFixed(precision)} {unit}
        </span>
      </div>

      {/* Bar */}
      <div className="relative h-3 w-full rounded-full bg-muted">
        {/* Reference zone */}
        {hasRefZone && (
          <div
            className="absolute inset-y-0 rounded-full bg-green-500/20"
            style={{
              left: `${refLeftPercent}%`,
              width: `${refWidthPercent}%`,
            }}
          />
        )}

        {/* Value indicator (diamond) */}
        <div
          className="absolute top-0 h-3 w-3 rotate-45 rounded-sm bg-foreground"
          style={{
            left: `calc(${valuePercent}% - 6px)`,
          }}
        />
      </div>

      {/* Left/Right labels */}
      <div className="flex justify-between">
        <span className="text-xs text-muted-foreground">{leftLabel}</span>
        <span className="text-xs text-muted-foreground">{rightLabel}</span>
      </div>
    </div>
  )
}
