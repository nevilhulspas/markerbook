'use client'

import { ShieldAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { APPROVAL_TOOL_LABELS, approvalDetails } from '@/lib/insights/tool-approval'

interface ApprovalCardProps {
  toolName: string
  input: unknown
  /** approval-requested: buttons; approval-responded / output-denied: the answer. */
  state: string
  approved?: boolean
  onAnswer: (approved: boolean) => void
}

/**
 * Confirm card for a chat tool that deletes or overwrites data (see
 * tool-approval.ts). The tool runs only after "Confirm"; the model cannot click.
 */
export function ApprovalCard({ toolName, input, state, approved, onAnswer }: ApprovalCardProps) {
  const label = APPROVAL_TOOL_LABELS[toolName] ?? 'Change your stored data'
  const details = approvalDetails(input)

  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <ShieldAlert className="size-4" />
        {label}?
      </div>
      {details.length > 0 && (
        <dl className="mt-1 space-y-0.5 text-muted-foreground">
          {details.map(([key, value]) => (
            <div key={key} className="flex gap-1.5">
              <dt className="shrink-0 capitalize">{key}:</dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {state === 'approval-requested' ? (
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={() => onAnswer(true)}>
            Confirm
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAnswer(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-muted-foreground">
          {state === 'output-denied' || approved === false ? 'Cancelled — nothing was changed.' : 'Confirmed.'}
        </p>
      )}
    </div>
  )
}
