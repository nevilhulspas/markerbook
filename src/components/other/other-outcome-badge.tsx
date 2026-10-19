import { Badge } from '@/components/ui/badge'
import { OTHER_OUTCOME_LABELS, OTHER_OUTCOME_VARIANTS } from '@/lib/other/display'
import type { OtherTestOutcome } from '@/lib/database.types'

export function OtherOutcomeBadge({
  outcome,
  className,
}: {
  outcome: OtherTestOutcome
  className?: string
}) {
  return (
    <Badge variant={OTHER_OUTCOME_VARIANTS[outcome]} className={className}>
      {OTHER_OUTCOME_LABELS[outcome]}
    </Badge>
  )
}
