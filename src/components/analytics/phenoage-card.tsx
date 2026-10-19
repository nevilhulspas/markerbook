'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { PhenoAgeReadiness } from '@/lib/analytics/phenoage'

interface PhenoAgeCardProps {
  chronologicalAge: number | null
  phenoAge: number | null
  readiness: PhenoAgeReadiness
}

export function PhenoAgeCard({
  chronologicalAge,
  phenoAge,
  readiness,
}: PhenoAgeCardProps) {
  // No date of birth -> prompt to complete profile
  if (chronologicalAge === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Biological Age</CardTitle>
          <CardDescription>PhenoAge estimate</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Complete your profile (date of birth) to calculate biological age.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Markers not ready -> show progress
  if (!readiness.ready || phenoAge === null) {
    const progressPercent = Math.round(
      (readiness.presentCount / readiness.totalRequired) * 100
    )

    return (
      <Card>
        <CardHeader>
          <CardTitle>Biological Age</CardTitle>
          <CardDescription>
            {readiness.presentCount}/{readiness.totalRequired} markers available
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Progress bar */}
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">
              Add these markers to your next blood test to calculate your
              biological age:
            </p>
            <ul className="space-y-0.5">
              {readiness.missing.map((name) => (
                <li
                  key={name}
                  className="text-sm text-muted-foreground"
                >
                  &bull; {name}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    )
  }

  // All markers present -> show biological age
  const diff = phenoAge - chronologicalAge
  const absDiff = Math.abs(diff)
  const isYounger = diff < -2
  const isOlder = diff > 2

  let colorClass = 'text-amber-500' // within 2 years
  let label = `${absDiff.toFixed(1)} years close to chronological age`
  if (isYounger) {
    colorClass = 'text-green-500'
    label = `${absDiff.toFixed(1)} years younger than chronological age`
  } else if (isOlder) {
    colorClass = 'text-red-500'
    label = `${absDiff.toFixed(1)} years older than chronological age`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Biological Age</CardTitle>
        <CardDescription>PhenoAge estimate (Levine 2018)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-bold tabular-nums ${colorClass}`}>
            {phenoAge.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground">years</span>
        </div>
        <div className="text-sm text-muted-foreground">
          Chronological age: {chronologicalAge}
        </div>
        <div className={`text-sm font-medium ${colorClass}`}>{label}</div>
      </CardContent>
    </Card>
  )
}
