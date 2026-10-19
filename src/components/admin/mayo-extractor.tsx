'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { extractMayoRanges } from '@/actions/admin/verification'
import type { ParsedMayoRange } from '@/lib/mayo/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface MayoExtractorProps {
  onExtracted: (ranges: ParsedMayoRange[], sourceUrl: string) => void
}

export function MayoExtractor({ onExtracted }: MayoExtractorProps) {
  const [html, setHtml] = useState('')
  const [url, setUrl] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExtract() {
    if (!html.trim()) {
      setError('Please paste HTML content first.')
      return
    }
    if (!url.trim()) {
      setError('Please enter the Mayo Clinic page URL.')
      return
    }

    setIsExtracting(true)
    setError(null)

    const result = await extractMayoRanges(html)

    if (result.error) {
      setError(result.error)
      setIsExtracting(false)
      return
    }

    toast.success(`Extracted ${result.ranges.length} range(s) from "${result.testName ?? 'Unknown'}"`)
    onExtracted(result.ranges, url)
    setIsExtracting(false)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="mayo-url">Mayo Clinic Test Page URL</Label>
        <Input
          id="mayo-url"
          placeholder="https://www.mayocliniclabs.com/test-catalog/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mayo-html">
          Page Source HTML
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            (Right-click page &gt; View Page Source &gt; Select All &gt; Copy)
          </span>
        </Label>
        <Textarea
          id="mayo-html"
          placeholder="Paste the full page source from a Mayo Clinic test catalog page..."
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          rows={8}
          className="font-mono text-xs"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        onClick={handleExtract}
        disabled={isExtracting || !html.trim() || !url.trim()}
      >
        {isExtracting && <Loader2 className="mr-2 size-4 animate-spin" />}
        Extract Ranges
      </Button>
    </div>
  )
}
