'use client'

/**
 * A `source-url` UIMessage part as streamed by the Vercel AI SDK when Claude
 * uses Anthropic's web_search tool. Field names match the SDK shape; `title`
 * may be omitted by the model.
 */
export interface SourcePart {
  type: 'source-url'
  sourceId?: string
  url: string
  title?: string
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Tight inline list of sources rendered beneath an assistant message that
 * cited the web. Deduped by URL (the model may emit duplicate sources across
 * multiple sentences). Renders nothing when `sources` is empty so callers can
 * unconditionally include it without an `&& sources.length > 0` guard.
 */
export function SourcesFooter({ sources }: { sources: SourcePart[] }) {
  // Dedupe by URL, preserving first-seen order. Reject any URL whose scheme
  // isn't http(s) — Anthropic's search results are trusted but URLs flow
  // through href, so guarding against javascript:/data: schemes is cheap
  // defense in depth.
  const seen = new Set<string>()
  const unique: SourcePart[] = []
  for (const s of sources) {
    if (!s.url || seen.has(s.url)) continue
    if (!/^https?:\/\//i.test(s.url)) continue
    seen.add(s.url)
    unique.push(s)
  }
  if (unique.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="font-medium">Sources:</span>
      {unique.map((s) => {
        const host = hostnameOf(s.url)
        return (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            title={s.title ?? s.url}
            className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- favicon is served from Google's CDN; adding it to next/image remotePatterns just for a 12px decorative icon is not worth it */}
            <img
              src={`https://www.google.com/s2/favicons?domain=${host}&sz=16`}
              alt=""
              width={12}
              height={12}
              className="size-3 rounded-sm"
              loading="lazy"
            />
            {host}
          </a>
        )
      })}
    </div>
  )
}
