'use client'

import type { SnpVariant } from '@/lib/database.types'
import { HEALTH_SNP_MAP } from '@/lib/genetics/health-snps'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface SnpSummaryProps {
  snps: SnpVariant[]
}

function getZygosity(genotype: string, riskAllele: string): string {
  const alleles = genotype.split('')
  const riskCount = alleles.filter((a) => a === riskAllele).length
  if (riskCount === 0) return 'Normal'
  if (riskCount === 1) return 'Heterozygous'
  return 'Homozygous'
}

function zygosityColor(zyg: string): string {
  if (zyg === 'Normal') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
  if (zyg === 'Heterozygous') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
}

export function SnpSummary({ snps }: SnpSummaryProps) {
  // Group by category
  const grouped = new Map<string, SnpVariant[]>()
  for (const snp of snps) {
    const cat = snp.category ?? 'Other'
    const list = grouped.get(cat) ?? []
    list.push(snp)
    grouped.set(cat, list)
  }

  // Filter out "Other" — those are SNPs with gene names from XLSX but not in our health catalog
  const categories = Array.from(grouped.entries())
    .filter(([cat]) => cat !== 'Other')
    .sort(([a], [b]) => a.localeCompare(b))

  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No health-relevant SNPs found. Import your genetic data to see results.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-green-500" />
          <span><strong>Normal</strong> — no variant detected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-yellow-500" />
          <span><strong>Heterozygous</strong> — one copy of variant (partial effect)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-red-500" />
          <span><strong>Homozygous</strong> — two copies of variant (full effect)</span>
        </div>
      </div>
      {categories.map(([category, categorySnps]) => (
        <Card key={category}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{category}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {categorySnps.map((snp) => {
                const healthInfo = HEALTH_SNP_MAP.get(snp.rsid)
                const zyg = healthInfo
                  ? getZygosity(snp.genotype, healthInfo.riskAllele)
                  : null

                return (
                  <div
                    key={snp.id}
                    className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {snp.gene_name}
                          {snp.variant_name && (
                            <span className="text-muted-foreground"> {snp.variant_name}</span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {snp.rsid}
                        </span>
                      </div>
                      {healthInfo && (
                        <p className="text-xs text-muted-foreground">
                          {healthInfo.description}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-sm">{snp.genotype}</span>
                      {zyg && (
                        <Badge
                          variant="secondary"
                          className={zygosityColor(zyg)}
                        >
                          {zyg}
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
