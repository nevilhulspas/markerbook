import Link from 'next/link'

import { cn } from '@/lib/utils'

const RANGES = [
  { k: 'today', label: 'Today' },
  { k: '7d', label: '7 days' },
  { k: '30d', label: '30 days' },
] as const

export function RangeTabs({ value }: { value: string }) {
  return (
    <div className="inline-flex rounded-lg border p-1">
      {RANGES.map((r) => (
        <Link
          key={r.k}
          href={`/nutrition?range=${r.k}`}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm',
            value === r.k ? 'bg-muted font-medium' : 'text-muted-foreground'
          )}
        >
          {r.label}
        </Link>
      ))}
    </div>
  )
}
