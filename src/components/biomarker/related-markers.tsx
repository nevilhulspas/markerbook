import Link from 'next/link'

interface RelatedMarkersProps {
  markers: Array<{
    id: string
    name: string
    short_name: string | null
    parent_id: string | null
  }>
  currentId: string
}

export function RelatedMarkers({ markers, currentId }: RelatedMarkersProps) {
  const filtered = markers
    .filter((m) => m.id !== currentId)
    .slice(0, 8)

  if (filtered.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2">
      {filtered.map((marker) => (
        <Link
          key={marker.id}
          href={`/biomarkers/${marker.id}`}
          className="rounded-full border px-3 py-1 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {marker.short_name ?? marker.name}
        </Link>
      ))}
    </div>
  )
}
