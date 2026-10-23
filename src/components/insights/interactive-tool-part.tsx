'use client'

import { ToolInvocationDisplay } from './tool-invocation-display'
import { QuestionPrompt } from './question-prompt'
import { LabTestLists } from './lab-test-list-card'
import { DocumentIndexCard, type DocumentIndexSummary } from './document-index-card'
import { ApprovalCard } from './approval-card'
import type { BuildListsResult } from '@/lib/labs/lab-test-tools'
import { askUserAnswerText, toolNameOf, type ToolPartLike } from '@/lib/insights/render-items'

export type ToolAnswer =
  | string
  | string[]
  | { choice: 'logged'; href: string }
  | { choice: 'chat-only' }
  | { approvalId: string; approved: boolean }

/** Render an interactive tool part: question prompt, answered note, or cards. */
export function renderInteractivePart(
  p: ToolPartLike,
  onToolAnswer: (toolCallId: string, answer: ToolAnswer) => void
) {
  const toolName = toolNameOf(p)

  // A delete/overwrite tool waiting for (or answered on) its confirm card.
  if (
    p.approval &&
    (p.state === 'approval-requested' || p.state === 'approval-responded' || p.state === 'output-denied')
  ) {
    const approvalId = p.approval.id
    return (
      <ApprovalCard
        toolName={toolName}
        input={p.input}
        state={p.state}
        approved={p.approval.approved}
        onAnswer={(approved) => onToolAnswer(p.toolCallId, { approvalId, approved })}
      />
    )
  }

  if (toolName === 'ask_user') {
    const input = (p.input ?? {}) as {
      question?: string
      options?: string[]
      multiple?: boolean
    }
    if (p.state === 'output-available') {
      const answer = askUserAnswerText(p.output)
      return (
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          {input.question && (
            <p className="text-muted-foreground">{input.question}</p>
          )}
          <p className="mt-1 font-medium">{answer}</p>
        </div>
      )
    }
    if (input.question && input.options && input.options.length > 0) {
      return (
        <QuestionPrompt
          question={input.question}
          options={input.options}
          multiple={input.multiple}
          onAnswer={(answer) => onToolAnswer(p.toolCallId, answer)}
        />
      )
    }
    return null
  }

  if (toolName === 'build_lab_test_lists' && p.state === 'output-available' && p.output) {
    return <LabTestLists result={p.output as BuildListsResult} />
  }

  if (toolName === 'confirm_health_document_index') {
    const input = (p.input ?? {}) as { extractionId?: string; summary?: DocumentIndexSummary }
    if (p.state === 'output-available') {
      const out = p.output as { choice?: string; href?: string } | undefined
      return (
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {out?.choice === 'logged' ? 'Logged to your record.' : 'Kept for this chat only.'}
        </div>
      )
    }
    // Only render once the tool input has finished streaming — mid-stream the
    // summary can be partial (e.g. `lines` not yet present), which would crash
    // the card. `Array.isArray(summary.lines)` is the completeness signal.
    if (input.extractionId && input.summary && Array.isArray(input.summary.lines)) {
      return (
        <DocumentIndexCard
          extractionId={input.extractionId}
          summary={input.summary}
          onResolve={(output) => onToolAnswer(p.toolCallId, output)}
        />
      )
    }
    return null
  }

  // Pass `input` so ToolInvocationDisplay can render tool-specific
  // running labels (e.g. "Adding HDL Cholesterol…") instead of the generic
  // spinner, and surface the arg in result renderers like the batch summary.
  return (
    <ToolInvocationDisplay
      toolName={toolName}
      state={p.state}
      input={p.input}
      output={p.output}
    />
  )
}
