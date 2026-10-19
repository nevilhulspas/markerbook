'use client'

import type { MicrobiomeScore, MicrobiomeStatus } from '@/lib/database.types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MicrobiomeBar } from '@/components/microbiome/microbiome-bar'
import { cn } from '@/lib/utils'
import { APP_LOCALE } from '@/lib/locale'

interface MicrobiomeScoresProps {
  scores: MicrobiomeScore[]
}

const STATUS_STYLES: Record<MicrobiomeStatus, string> = {
  low: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  normal:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  high: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
  unknown: 'bg-muted text-muted-foreground',
}

// Display overrides for score keys that don't title-case cleanly
// (acronyms, ratios, scientific names).
const LABEL_OVERRIDES: Record<string, string> = {
  shannon_diversity: 'Shannon Diversity',
  dysbiosis_index: 'Dysbiosis Index',
  firmicutes_bacteroidetes_ratio: 'Firmicutes / Bacteroidetes',
  actinobacteria_proteobacteria_ratio: 'Actinobacteria / Proteobacteria',
  prevotella_bacteroides_ratio: 'Prevotella / Bacteroides',
  fecal_ph: 'Fecal pH',
  secondary_bile_acids: 'Secondary Bile Acids',
  tma_tmao: 'TMA / TMAO',
  indoxyl_sulfate: 'Indoxyl Sulfate',
  beta_glucuronidase: 'Beta-glucuronidase',
  alpha_1_antitrypsin: 'Alpha-1-antitrypsin',
  secretory_iga: 'Secretory IgA',
}

function humanize(name: string): string {
  if (LABEL_OVERRIDES[name]) return LABEL_OVERRIDES[name]
  return name
    .split(/[_\s]+/)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ')
}

export function MicrobiomeScores({ scores }: MicrobiomeScoresProps) {
  if (scores.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scores</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {scores.map((s) => (
            <div
              key={s.id}
              className="rounded-md border bg-card p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium">{humanize(s.name)}</div>
                <Badge
                  variant="secondary"
                  className={cn(
                    'capitalize',
                    STATUS_STYLES[(s.status ?? 'unknown') as MicrobiomeStatus]
                  )}
                >
                  {s.status ?? 'unknown'}
                </Badge>
              </div>
              <div className="mt-2 font-mono text-2xl tabular-nums">
                {s.value.toLocaleString(APP_LOCALE, {
                  maximumFractionDigits: 2,
                })}
                {s.unit && (
                  <span className="ml-1 text-base text-muted-foreground">
                    {s.unit}
                  </span>
                )}
              </div>
              {(s.ref_low != null || s.ref_high != null) && (
                <>
                  <div className="mt-2">
                    <MicrobiomeBar
                      value={s.value}
                      refLow={s.ref_low}
                      refHigh={s.ref_high}
                      unit={s.unit}
                      status={s.status}
                    />
                  </div>
                  <div className="mt-1.5 text-xs text-muted-foreground">
                    Reference: {s.ref_low ?? '0'} – {s.ref_high ?? '∞'}
                    {s.unit ? ` ${s.unit}` : ''}
                  </div>
                </>
              )}
              {s.description && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {s.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
